// Regras para descobrir a qual peça cada foto pertence. Usado no navegador (prévia) e no servidor.

export type ModoAgrupamento = "uma" | "cada" | "nome";

export type ArquivoInfo = {
  /** Nome do arquivo, ex.: "VESTIDO-FLORAL_1.jpg" */
  name: string;
  /** Caminho relativo quando veio de uma pasta, ex.: "lote/VESTIDO-FLORAL/1.jpg" */
  relativePath?: string;
};

export type Grupo = { code: string; indices: number[] };

/** Maiúsculas, sem acentos, espaços viram "-", só letras/números/-/_ */
export function normalizarCodigo(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^A-Z0-9_-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");
}

function semExtensao(nome: string): string {
  return nome.replace(/\.[^.]+$/, "");
}

/** "VESTIDO-FLORAL_2.jpg" → "VESTIDO-FLORAL". Sem "_" → nome inteiro. */
export function codigoPeloNome(nome: string): string {
  const base = semExtensao(nome);
  const idx = base.lastIndexOf("_");
  const codigo = idx > 0 ? base.slice(0, idx) : base;
  return normalizarCodigo(codigo) || "SEM-NOME";
}

/** "lote/VESTIDO/1.jpg" → "VESTIDO". Se a foto estiver direto na pasta escolhida, usa a regra do nome. */
function codigoPelaPasta(arq: ArquivoInfo): string {
  const partes = (arq.relativePath || "").split(/[\\/]/).filter(Boolean);
  if (partes.length >= 3) return normalizarCodigo(partes[partes.length - 2]) || codigoPeloNome(arq.name);
  return codigoPeloNome(arq.name);
}

export function agrupar(arquivos: ArquivoInfo[], modo: ModoAgrupamento, nomeUnico?: string): Grupo[] {
  if (arquivos.length === 0) return [];

  if (modo === "uma") {
    const code = normalizarCodigo(nomeUnico || "") || codigoPeloNome(arquivos[0].name);
    return [{ code, indices: arquivos.map((_, i) => i) }];
  }

  if (modo === "cada") {
    return garantirCodigosUnicos(
      arquivos.map((a, i) => ({ code: normalizarCodigo(semExtensao(a.name)) || "SEM-NOME", indices: [i] })),
    );
  }

  const mapa = new Map<string, number[]>();
  arquivos.forEach((a, i) => {
    const code = a.relativePath ? codigoPelaPasta(a) : codigoPeloNome(a.name);
    const lista = mapa.get(code) ?? [];
    lista.push(i);
    mapa.set(code, lista);
  });
  return [...mapa.entries()].map(([code, indices]) => ({ code, indices }));
}

/** Evita duas peças com o mesmo código no mesmo lote (VESTIDO, VESTIDO-2, ...). */
export function garantirCodigosUnicos(grupos: Grupo[]): Grupo[] {
  const usados = new Map<string, number>();
  return grupos.map((g) => {
    const n = (usados.get(g.code) ?? 0) + 1;
    usados.set(g.code, n);
    return n === 1 ? g : { ...g, code: `${g.code}-${n}` };
  });
}
