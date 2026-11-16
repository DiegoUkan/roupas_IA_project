import { db, newId, nowIso, transaction } from "./db";
import { FUNDOS, LIMITES, POSES, fundoById, poseById } from "./catalog";
import { getBrandModel } from "./brandModels";
import { garantirCodigosUnicos, normalizarCodigo } from "./grouping";
import { arquivoUrl, fileUrl, removeDataPath, toRel } from "./paths";
import { processarFila, type JobRow } from "./queue";
import { moverParaLixeira, restaurarDaLixeira } from "./saida";
import { getSettings } from "./settings";
import { getUploads } from "./uploads";

/** Opções guardadas em cada peça (items.options). */
export type OpcoesItem = {
  /** Caminho da pasta do produto dentro de "Para editar" (só para produtos vindos das pastas). */
  folderPath?: string;
  /** Instruções do prompt.txt (ou editadas na tela). */
  extraPrompt?: string;
  /** Fundo próprio deste produto. */
  backgroundId?: string;
  /** Modelo própria deste produto (null = manter a pessoa da foto). Ausente = usa a do lote. */
  brandModelId?: string | null;
};

export type GrupoLote = {
  code: string;
  uploadIds: string[];
  product?: string;
  /** Poses próprias deste produto; ausente = poses do lote. */
  poses?: string[];
} & OpcoesItem;

export type NovoLote = {
  groups: GrupoLote[];
  poses: string[];
  backgroundId: string;
  brandModelId: string | null;
  description: string;
  variations: number;
};

function posesValidas(lista: unknown): string[] {
  if (!Array.isArray(lista)) return [];
  return [...new Set(lista.filter((id): id is string => typeof id === "string"))].filter((id) => POSES.some((p) => p.id === id));
}

export function criarLote(input: NovoLote): string {
  const poses = posesValidas(input.poses);
  if (poses.length === 0) throw new Error("Escolha pelo menos uma pose.");
  if (!FUNDOS.some((f) => f.id === input.backgroundId)) throw new Error("Fundo inválido.");
  if (input.brandModelId && !getBrandModel(input.brandModelId)) throw new Error("Modelo da marca não encontrada.");

  const variations = Math.min(LIMITES.variacoesMax, Math.max(1, Math.round(Number(input.variations) || 1)));
  const validos = (input.groups ?? []).filter((g) => Array.isArray(g.uploadIds) && g.uploadIds.length > 0);
  const codigos = garantirCodigosUnicos(
    validos.map((g, i) => ({ code: normalizarCodigo(String(g.code ?? "")) || `PECA-${i + 1}`, indices: [i] })),
  );
  const groups = validos.map((g, i) => {
    const opcoes: OpcoesItem = {};
    if (typeof g.folderPath === "string" && g.folderPath) opcoes.folderPath = g.folderPath;
    if (typeof g.extraPrompt === "string" && g.extraPrompt.trim()) opcoes.extraPrompt = g.extraPrompt.trim().slice(0, 3000);
    if (typeof g.backgroundId === "string" && FUNDOS.some((f) => f.id === g.backgroundId)) opcoes.backgroundId = g.backgroundId;
    if (g.brandModelId === null) opcoes.brandModelId = null;
    else if (typeof g.brandModelId === "string" && g.brandModelId) {
      if (!getBrandModel(g.brandModelId)) throw new Error("Modelo da marca não encontrada.");
      opcoes.brandModelId = g.brandModelId;
    }
    const posesProprias = posesValidas(g.poses);
    return {
      code: codigos[i].code,
      uploadIds: [...new Set(g.uploadIds.filter((x): x is string => typeof x === "string"))],
      product: String(g.product ?? "").trim().slice(0, 200),
      poses: posesProprias.length ? posesProprias : poses,
      opcoes,
    };
  });

  if (groups.length === 0) throw new Error("Envie pelo menos uma foto.");
  const totalFotos = groups.reduce((n, g) => n + g.uploadIds.length, 0);
  if (totalFotos > LIMITES.arquivosPorLoteMax) throw new Error(`Máximo de ${LIMITES.arquivosPorLoteMax} fotos por lote.`);

  const uploads = getUploads(groups.flatMap((g) => g.uploadIds));
  for (const g of groups) {
    if (g.uploadIds.length > LIMITES.fotosPorPecaMax) {
      throw new Error(`A peça ${g.code} tem ${g.uploadIds.length} fotos; o máximo é ${LIMITES.fotosPorPecaMax} por peça.`);
    }
    for (const id of g.uploadIds) if (!uploads.has(id)) throw new Error("Uma das fotos não foi encontrada. Envie de novo.");
  }

  const settings = getSettings();
  const batchId = newId();
  const agora = nowIso();

  transaction(() => {
    const conn = db();
    conn
      .prepare(
        "INSERT INTO batches (id, created_at, background_id, brand_model_id, description, poses, variations, options) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        batchId,
        agora,
        input.backgroundId,
        input.brandModelId || null,
        (input.description || "").trim().slice(0, 1000),
        JSON.stringify(poses),
        variations,
        JSON.stringify({ aspect: settings.aspect, quality: settings.quality }),
      );

    const insItem = conn.prepare(
      "INSERT INTO items (id, batch_id, code, source_images, position, product, options) VALUES (?, ?, ?, ?, ?, ?, ?)",
    );
    const insJob = conn.prepare(
      "INSERT INTO jobs (id, batch_id, item_id, pose_id, variation, position, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'pendente', ?, ?)",
    );

    let pos = 0;
    groups.forEach((g, gi) => {
      const itemId = newId();
      insItem.run(
        itemId,
        batchId,
        g.code,
        JSON.stringify(g.uploadIds.map((id) => uploads.get(id)!.file)),
        gi,
        g.product,
        JSON.stringify(g.opcoes),
      );
      for (const poseId of g.poses) {
        for (let v = 1; v <= variations; v++) insJob.run(newId(), batchId, itemId, poseId, v, pos++, agora, agora);
      }
    });
  });

  processarFila();
  return batchId;
}

/** Quantas imagens um conjunto de produtos vai gerar (para mostrar antes e estimar custo). */
export function contarImagens(grupos: { poses?: string[] }[], posesPadrao: string[], variacoes: number): number {
  return grupos.reduce((n, g) => n + (g.poses?.length ? g.poses.length : posesPadrao.length) * variacoes, 0);
}

type Contagem = { total: number; pronto: number; erro: number; gerando: number; pendente: number };

function contar(batchId: string): Contagem {
  const rows = db().prepare("SELECT status, COUNT(*) AS n FROM jobs WHERE batch_id = ? GROUP BY status").all(batchId) as {
    status: string;
    n: number;
  }[];
  const c: Contagem = { total: 0, pronto: 0, erro: 0, gerando: 0, pendente: 0 };
  for (const r of rows) {
    c.total += r.n;
    if (r.status in c) c[r.status as keyof Omit<Contagem, "total">] += r.n;
  }
  return c;
}

type BatchRow = {
  id: string;
  created_at: string;
  background_id: string;
  brand_model_id: string | null;
  description: string;
  poses: string;
  variations: number;
  options: string;
};

type ItemRow = { id: string; code: string; source_images: string; product: string; options: string };

export function lerOpcoesItem(raw: string | null | undefined): OpcoesItem {
  try {
    return JSON.parse(raw || "{}") as OpcoesItem;
  } catch {
    return {};
  }
}

export function listarLotes() {
  const rows = db().prepare("SELECT * FROM batches ORDER BY created_at DESC LIMIT 200").all() as BatchRow[];
  return rows.map((b) => {
    const pecas = db().prepare("SELECT code, product FROM items WHERE batch_id = ? ORDER BY position").all(b.id) as {
      code: string;
      product: string;
    }[];
    const capa = db()
      .prepare("SELECT output_file FROM jobs WHERE batch_id = ? AND status = 'pronto' ORDER BY position LIMIT 1")
      .get(b.id) as { output_file: string } | undefined;
    const custo = db().prepare("SELECT COALESCE(SUM(cost_usd), 0) AS c FROM jobs WHERE batch_id = ?").get(b.id) as { c: number };
    return {
      id: b.id,
      createdAt: b.created_at,
      pecas: pecas.map((p) => p.product || p.code),
      fundo: fundoById(b.background_id)?.nome ?? b.background_id,
      contagem: contar(b.id),
      custoUSD: custo.c,
      capaUrl: capa?.output_file ? fileUrl(capa.output_file) : null,
    };
  });
}

export function detalharLote(id: string) {
  const conn = db();
  const b = conn.prepare("SELECT * FROM batches WHERE id = ?").get(id) as BatchRow | undefined;
  if (!b) return null;
  const items = conn.prepare("SELECT * FROM items WHERE batch_id = ? ORDER BY position").all(id) as ItemRow[];
  const jobs = conn.prepare("SELECT * FROM jobs WHERE batch_id = ? ORDER BY position").all(id) as JobRow[];
  const modelo = b.brand_model_id ? getBrandModel(b.brand_model_id) : null;
  const opcoes = JSON.parse(b.options || "{}") as { aspect?: string; quality?: string };

  return {
    id: b.id,
    createdAt: b.created_at,
    fundo: fundoById(b.background_id)?.nome ?? b.background_id,
    modelo: modelo ? modelo.name : b.brand_model_id ? "(modelo apagada)" : null,
    descricao: b.description,
    variacoes: b.variations,
    proporcao: opcoes.aspect ?? "",
    qualidade: opcoes.quality ?? "",
    contagem: contar(id),
    custoUSD: jobs.reduce((s, j) => s + (j.cost_usd ?? 0), 0),
    pecas: items.map((it) => {
      const op = lerOpcoesItem(it.options);
      const modeloItem =
        op.brandModelId === undefined ? undefined : op.brandModelId === null ? null : getBrandModel(op.brandModelId);
      return {
        id: it.id,
        code: it.code,
        produto: it.product,
        pasta: op.folderPath ?? null,
        instrucoes: op.extraPrompt ?? null,
        fundo: op.backgroundId ? (fundoById(op.backgroundId)?.nome ?? op.backgroundId) : null,
        modelo: modeloItem === undefined ? undefined : modeloItem === null ? null : modeloItem.name,
        originais: (JSON.parse(it.source_images) as string[]).map(fileUrl),
        imagens: jobs
          .filter((j) => j.item_id === it.id)
          .map((j) => ({
            id: j.id,
            pose: poseById(j.pose_id)?.nome ?? j.pose_id,
            variacao: j.variation,
            status: j.status,
            tentativas: j.attempts,
            erro: j.error,
            url: j.output_file ? fileUrl(j.output_file) : null,
            proximaTentativa: j.next_attempt_at,
            revisao: j.review as "aprovada" | "reprovada" | null,
            arquivoSaida: j.exported_file,
            arquivoSaidaUrl: j.exported_file && j.review !== "reprovada" ? arquivoUrl(j.exported_file) : null,
            custoUSD: j.cost_usd,
          })),
      };
    }),
  };
}

export function apagarLote(id: string) {
  db().prepare("DELETE FROM batches WHERE id = ?").run(id);
  removeDataPath(toRel("outputs", id));
}

/**
 * Volta uma imagem (pronta ou com erro) para a fila.
 * A versão anterior sai da pasta Editadas (vai para a lixeira interna).
 */
export function refazerImagem(jobId: string) {
  const conn = db();
  const job = conn.prepare("SELECT * FROM jobs WHERE id = ?").get(jobId) as JobRow | undefined;
  if (!job) throw new Error("Imagem não encontrada.");
  if (job.status === "gerando") throw new Error("Esta imagem já está sendo gerada.");
  if (job.review !== "reprovada") moverParaLixeira(job.id, job.exported_file);
  if (job.output_file) removeDataPath(job.output_file);
  conn
    .prepare(
      `UPDATE jobs SET status = 'pendente', attempts = 0, error = NULL, output_file = NULL, usage = NULL,
       next_attempt_at = NULL, review = NULL, exported_file = NULL, updated_at = ? WHERE id = ?`,
    )
    .run(nowIso(), jobId);
  processarFila();
}

/** Aprovar, reprovar (tira da pasta Editadas) ou desfazer a revisão (devolve para a pasta). */
export function revisarImagem(jobId: string, revisao: "aprovada" | "reprovada" | null) {
  const conn = db();
  const job = conn.prepare("SELECT * FROM jobs WHERE id = ?").get(jobId) as JobRow | undefined;
  if (!job) throw new Error("Imagem não encontrada.");
  if (job.status !== "pronto") throw new Error("Só dá para revisar imagens prontas.");

  let exportado = job.exported_file;
  if (revisao === "reprovada" && job.review !== "reprovada") moverParaLixeira(job.id, exportado);
  if (revisao !== "reprovada" && job.review === "reprovada") exportado = restaurarDaLixeira(job.id, exportado);

  conn.prepare("UPDATE jobs SET review = ?, exported_file = ?, updated_at = ? WHERE id = ?").run(revisao, exportado, nowIso(), jobId);
}

/** Arquivos prontos de um lote (sem as reprovadas), para montar o ZIP. */
export function arquivosProntos(id: string) {
  return db()
    .prepare(
      `SELECT i.code, i.product, j.pose_id, j.variation, j.output_file FROM jobs j JOIN items i ON i.id = j.item_id
       WHERE j.batch_id = ? AND j.status = 'pronto' AND j.output_file IS NOT NULL
         AND (j.review IS NULL OR j.review <> 'reprovada')
       ORDER BY j.position`,
    )
    .all(id) as { code: string; product: string; pose_id: string; variation: number; output_file: string }[];
}
