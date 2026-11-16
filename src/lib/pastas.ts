import fs from "node:fs";
import path from "node:path";
import { criarLote } from "./batches";
import { getDefaultBrandModel } from "./brandModels";
import { LIMITES } from "./catalog";
import { db, nowIso, transaction } from "./db";
import { normalizarCodigo } from "./grouping";
import { ARQUIVOS_DIR, ENTRADA_DIR, PASTA_ENTRADA, PASTA_SAIDA, SAIDA_DIR, arquivoUrl, ensureArquivos } from "./paths";
import { getSettings } from "./settings";
import { salvarUploadBuffer } from "./uploads";

const EXTENSOES = /\.(jpe?g|png|webp)$/i;
/** Uma foto só é considerada pronta depois de ficar este tempo sem mudar (evita pegar arquivo pela metade). */
const ESTAVEL_MS = Math.max(0, Number(process.env.PASTAS_ESTAVEL_SEGUNDOS ?? 20)) * 1000;
const INTERVALO_MS = 60_000;

/**
 * mtime = data de modificação (copiar arquivo costuma preservar a original);
 * mudou = quando o arquivo chegou/mudou na pasta (maior entre mtime e ctime) — usado só para saber se terminou de copiar.
 */
export type Foto = { nome: string; tamanho: number; mtime: number; mudou?: number };
export type StatusPasta = "novo" | "fotos-novas" | "copiando" | "processado" | "ignorado";

type PastaRow = {
  caminho: string;
  nome: string;
  fotos: string;
  processadas: string;
  ignorada: string | null;
  prompt_txt: string | null;
  visto_em: string;
  ultimo_lote: string | null;
};

type EstadoVarredura = { iniciada: boolean; ultima: string | null; fotosSoltas: number; gerandoAuto: boolean };
const g = globalThis as unknown as { __estudioVarredura?: EstadoVarredura };
function estado(): EstadoVarredura {
  if (!g.__estudioVarredura) g.__estudioVarredura = { iniciada: false, ultima: null, fotosSoltas: 0, gerandoAuto: false };
  return g.__estudioVarredura;
}

const assinatura = (f: Foto) => `${f.nome}|${f.tamanho}|${Math.round(f.mtime)}`;
const conjunto = (fotos: Foto[]) => fotos.map(assinatura).sort().join(";");

/** Pastas de sistema/lixeira de NAS e arquivos ocultos ficam de fora. */
function ignorarNome(nome: string): boolean {
  return nome.startsWith(".") || nome.startsWith("_") || nome === "@eaDir" || nome === "#recycle" || nome === "$RECYCLE.BIN";
}

function absEntrada(caminho: string): string | null {
  const full = path.resolve(ENTRADA_DIR, caminho);
  return full.startsWith(ENTRADA_DIR + path.sep) ? full : null;
}

/** Percorre "Para editar": toda pasta que tem fotos é um produto. */
function lerDisco() {
  ensureArquivos();
  const produtos: { caminho: string; nome: string; fotos: Foto[]; promptTxt: string | null }[] = [];
  let soltas = 0;

  const andar = (abs: string, rel: string, nivel: number) => {
    if (nivel > 12) return;
    let itens: fs.Dirent[];
    try {
      itens = fs.readdirSync(abs, { withFileTypes: true });
    } catch {
      return;
    }
    const fotos: Foto[] = [];
    let promptTxt: string | null = null;
    for (const it of itens) {
      if (ignorarNome(it.name)) continue;
      const p = path.join(abs, it.name);
      if (it.isDirectory()) {
        andar(p, rel ? `${rel}/${it.name}` : it.name, nivel + 1);
      } else if (it.isFile()) {
        if (EXTENSOES.test(it.name)) {
          try {
            const st = fs.statSync(p);
            fotos.push({
              nome: it.name,
              tamanho: st.size,
              mtime: st.mtimeMs,
              mudou: Math.max(st.mtimeMs, st.ctimeMs, st.birthtimeMs || 0),
            });
          } catch {
            /* sumiu durante a leitura */
          }
        } else if (it.name.toLowerCase() === "prompt.txt") {
          try {
            promptTxt = fs.readFileSync(p, "utf8").replace(/^﻿/, "").trim().slice(0, 3000) || null;
          } catch {
            /* ignora */
          }
        }
      }
    }
    if (!rel) {
      soltas = fotos.length;
      return;
    }
    if (fotos.length > 0) {
      fotos.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { numeric: true }));
      produtos.push({ caminho: rel, nome: path.basename(rel), fotos, promptTxt });
    }
  };

  andar(ENTRADA_DIR, "", 0);
  return { produtos, soltas };
}

/** Lê o disco e atualiza o banco. Depois, se o modo automático estiver ligado, já manda gerar. */
export function varrer() {
  const { produtos, soltas } = lerDisco();
  const agora = nowIso();
  transaction(() => {
    const conn = db();
    const up = conn.prepare(
      `INSERT INTO pastas (caminho, nome, fotos, prompt_txt, visto_em) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(caminho) DO UPDATE SET nome = excluded.nome, fotos = excluded.fotos,
         prompt_txt = excluded.prompt_txt, visto_em = excluded.visto_em`,
    );
    for (const p of produtos) up.run(p.caminho, p.nome, JSON.stringify(p.fotos), p.promptTxt, agora);
    conn.prepare("DELETE FROM pastas WHERE visto_em <> ?").run(agora);
  });
  const st = estado();
  st.ultima = agora;
  st.fotosSoltas = soltas;
  if (getSettings().autoMode) void gerarAutomatico();
  return resumo();
}

function calcularStatus(row: PastaRow): { status: StatusPasta; novas: number } {
  const fotos = JSON.parse(row.fotos) as Foto[];
  const processadas = new Set(JSON.parse(row.processadas) as string[]);
  const novas = fotos.filter((f) => !processadas.has(assinatura(f))).length;
  if (row.ignorada && row.ignorada === conjunto(fotos)) return { status: "ignorado", novas };
  if (novas === 0) return { status: "processado", novas };
  if (fotos.some((f) => Date.now() - (f.mudou ?? f.mtime) < ESTAVEL_MS)) return { status: "copiando", novas };
  return { status: processadas.size === 0 ? "novo" : "fotos-novas", novas };
}

const ehPendente = (s: StatusPasta) => s === "novo" || s === "fotos-novas";

function contarEditadas(caminho: string): number {
  try {
    return fs.readdirSync(path.join(SAIDA_DIR, caminho)).filter((n) => EXTENSOES.test(n)).length;
  } catch {
    return 0;
  }
}

export function listarPastas(todas: boolean) {
  const rows = db().prepare("SELECT * FROM pastas ORDER BY caminho COLLATE NOCASE").all() as PastaRow[];
  return rows
    .map((r) => {
      const fotos = JSON.parse(r.fotos) as Foto[];
      const { status, novas } = calcularStatus(r);
      const categoria = r.caminho.includes("/") ? r.caminho.slice(0, r.caminho.lastIndexOf("/")) : "";
      return {
        caminho: r.caminho,
        nome: r.nome,
        categoria,
        status,
        novas,
        totalFotos: fotos.length,
        usadas: Math.min(fotos.length, LIMITES.fotosPorPecaMax),
        fotos: fotos.slice(0, 8).map((f) => ({
          nome: f.nome,
          url: arquivoUrl(`${PASTA_ENTRADA}/${r.caminho}/${f.nome}`),
          mini: arquivoUrl(`${PASTA_ENTRADA}/${r.caminho}/${f.nome}`, true),
        })),
        promptTxt: r.prompt_txt,
        ultimoLote: r.ultimo_lote,
        editadas: contarEditadas(r.caminho),
      };
    })
    .filter((p) => todas || ehPendente(p.status) || p.status === "copiando");
}

export function resumo() {
  const rows = db().prepare("SELECT * FROM pastas").all() as PastaRow[];
  const st = estado();
  return {
    pendentes: rows.filter((r) => ehPendente(calcularStatus(r).status)).length,
    total: rows.length,
    ultimaVarredura: st.ultima,
    fotosSoltas: st.fotosSoltas,
    autoMode: getSettings().autoMode,
    pastaArquivos: ARQUIVOS_DIR,
    pastaEntrada: PASTA_ENTRADA,
    pastaSaida: PASTA_SAIDA,
  };
}

export type ProdutoParaGerar = {
  caminho: string;
  produto?: string;
  instrucoes?: string;
  poses?: string[];
  backgroundId?: string;
  brandModelId?: string | null;
};

export type PadraoGeracao = {
  poses: string[];
  backgroundId: string;
  brandModelId: string | null;
  variations: number;
  description: string;
};

/** Cria um lote a partir das pastas escolhidas e marca as fotos como processadas. */
export async function gerarDePastas(produtos: ProdutoParaGerar[], padrao: PadraoGeracao): Promise<string> {
  if (!produtos.length) throw new Error("Escolha pelo menos um produto.");
  const conn = db();
  const grupos = [];
  const marcar: { caminho: string; processadas: string[] }[] = [];

  for (const p of produtos) {
    const row = conn.prepare("SELECT * FROM pastas WHERE caminho = ?").get(p.caminho) as PastaRow | undefined;
    const dir = absEntrada(p.caminho);
    if (!row || !dir || !fs.existsSync(dir)) throw new Error(`A pasta "${p.caminho}" não foi encontrada. Clique em Verificar agora.`);

    // Lê o estado atual do disco (pode ter mudado desde a última varredura).
    const fotos = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isFile() && EXTENSOES.test(d.name) && !ignorarNome(d.name))
      .map((d) => {
        const st = fs.statSync(path.join(dir, d.name));
        return { nome: d.name, tamanho: st.size, mtime: st.mtimeMs };
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { numeric: true }));
    if (fotos.length === 0) throw new Error(`A pasta "${p.caminho}" não tem fotos.`);

    const uploadIds: string[] = [];
    for (const f of fotos.slice(0, LIMITES.fotosPorPecaMax)) {
      try {
        uploadIds.push((await salvarUploadBuffer(fs.readFileSync(path.join(dir, f.nome)), f.nome)).id);
      } catch (e) {
        throw new Error(`"${p.caminho}/${f.nome}": ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    const instrucoes = p.instrucoes !== undefined ? p.instrucoes : (row.prompt_txt ?? "");
    grupos.push({
      code: normalizarCodigo(row.nome) || "PRODUTO",
      uploadIds,
      product: (p.produto ?? row.nome).trim() || row.nome,
      poses: p.poses,
      backgroundId: p.backgroundId,
      brandModelId: p.brandModelId,
      extraPrompt: instrucoes,
      folderPath: p.caminho,
    });
    marcar.push({ caminho: p.caminho, processadas: fotos.map(assinatura) });
  }

  const loteId = criarLote({ ...padrao, groups: grupos });

  const upd = conn.prepare("UPDATE pastas SET processadas = ?, ignorada = NULL, ultimo_lote = ? WHERE caminho = ?");
  for (const m of marcar) upd.run(JSON.stringify(m.processadas), loteId, m.caminho);
  return loteId;
}

export function padraoDasConfiguracoes(): PadraoGeracao {
  const s = getSettings();
  return {
    poses: s.defaultPoses,
    backgroundId: s.defaultBackground,
    brandModelId: getDefaultBrandModel()?.id ?? null,
    variations: s.variations,
    description: "",
  };
}

/** Modo automático: tudo que estiver pendente (e já terminou de copiar) vai para a fila com os padrões. */
async function gerarAutomatico() {
  const st = estado();
  if (st.gerandoAuto) return;
  st.gerandoAuto = true;
  try {
    const pendentes = listarPastas(false).filter((p) => ehPendente(p.status));
    if (pendentes.length) {
      const id = await gerarDePastas(
        pendentes.map((p) => ({ caminho: p.caminho })),
        padraoDasConfiguracoes(),
      );
      console.log(`[pastas] modo automático: ${pendentes.length} produto(s) no lote ${id}`);
    }
  } catch (e) {
    console.error("[pastas] modo automático falhou", e);
  } finally {
    st.gerandoAuto = false;
  }
}

/** Esconde um produto da lista até as fotos mudarem (ou mostra de novo). */
export function ignorarPasta(caminho: string, ignorar: boolean) {
  const row = db().prepare("SELECT * FROM pastas WHERE caminho = ?").get(caminho) as PastaRow | undefined;
  if (!row) throw new Error("Pasta não encontrada.");
  const valor = ignorar ? conjunto(JSON.parse(row.fotos) as Foto[]) : null;
  db().prepare("UPDATE pastas SET ignorada = ? WHERE caminho = ?").run(valor, caminho);
}

/** Pastas que servem de categoria (para a tela Novo produto). */
export function listarCategorias(): string[] {
  ensureArquivos();
  const out: string[] = [];
  const andar = (abs: string, rel: string, nivel: number) => {
    if (nivel > 4) return;
    let itens: fs.Dirent[];
    try {
      itens = fs.readdirSync(abs, { withFileTypes: true });
    } catch {
      return;
    }
    const temFotos = itens.some((i) => i.isFile() && EXTENSOES.test(i.name));
    if (rel && !temFotos) out.push(rel);
    if (rel && temFotos) return; // pasta de produto não vira categoria (a raiz sempre é percorrida)
    for (const i of itens) if (i.isDirectory() && !ignorarNome(i.name)) andar(path.join(abs, i.name), rel ? `${rel}/${i.name}` : i.name, nivel + 1);
  };
  andar(ENTRADA_DIR, "", 0);
  return out.sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/** Limpa um nome para virar pasta/arquivo (aceita espaço e acento). */
export function limparNome(nome: string): string {
  return nome
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 80)
    .trim();
}

function nomeLivre(dir: string, nome: string): string {
  const ext = path.extname(nome) || ".jpg";
  const base = path.basename(nome, ext);
  let n = 1;
  for (;;) {
    const candidato = n === 1 ? `${base}${ext}` : `${base} ${n}${ext}`;
    if (!fs.existsSync(path.join(dir, candidato))) return candidato;
    n++;
  }
}

/** Cria (ou completa) a pasta de um produto em "Para editar" com as fotos enviadas pelo celular. */
export function criarProduto(input: {
  nome: string;
  categoria: string;
  instrucoes: string;
  fotos: { nome: string; data: Buffer }[];
}): string {
  const nome = limparNome(input.nome);
  if (!nome) throw new Error("Dê um nome para o produto.");
  if (input.fotos.length === 0) throw new Error("Envie pelo menos uma foto.");
  const categoria = input.categoria
    .split("/")
    .map(limparNome)
    .filter(Boolean)
    .join("/");
  const caminho = categoria ? `${categoria}/${nome}` : nome;
  const dir = absEntrada(caminho);
  if (!dir) throw new Error("Nome de pasta inválido.");
  fs.mkdirSync(dir, { recursive: true });

  input.fotos.forEach((f, i) => {
    const ext = EXTENSOES.test(f.nome) ? path.extname(f.nome).toLowerCase() : ".jpg";
    const base = limparNome(path.basename(f.nome, path.extname(f.nome))) || `foto ${i + 1}`;
    fs.writeFileSync(path.join(/*turbopackIgnore: true*/ dir, nomeLivre(dir, base + ext)), f.data);
  });
  if (input.instrucoes.trim()) fs.writeFileSync(path.join(dir, "prompt.txt"), input.instrucoes.trim() + "\n", "utf8");

  varrer();
  return caminho;
}

/** Liga a varredura periódica (a cada minuto). Chamado quando o servidor sobe. */
export function iniciarVarredura() {
  const st = estado();
  if (st.iniciada) return;
  st.iniciada = true;
  const rodar = () => {
    try {
      varrer();
    } catch (e) {
      console.error("[pastas] erro na varredura", e);
    }
  };
  setTimeout(rodar, 3000);
  setInterval(rodar, INTERVALO_MS);
}
