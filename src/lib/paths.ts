import fs from "node:fs";
import path from "node:path";

/** Pasta onde ficam banco, fotos enviadas e imagens geradas. No Docker: /app/data (volume). */
export const DATA_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR || path.join(process.cwd(), "data"));

export const DIRS = {
  uploads: path.join(DATA_DIR, "uploads"),
  outputs: path.join(DATA_DIR, "outputs"),
  modelos: path.join(DATA_DIR, "modelos"),
  lixeira: path.join(DATA_DIR, "lixeira"),
};

/**
 * Pasta de trabalho da loja (no CasaOS: /DATA/AppData/estudio-ia/arquivos).
 * Dentro dela: "Para editar" (entrada) e "Editadas" (saída, mesma estrutura).
 */
export const ARQUIVOS_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.ARQUIVOS_DIR || path.join(process.cwd(), "arquivos"));
export const PASTA_ENTRADA = "Para editar";
export const PASTA_SAIDA = "Editadas";
export const ENTRADA_DIR = path.join(ARQUIVOS_DIR, PASTA_ENTRADA);
export const SAIDA_DIR = path.join(ARQUIVOS_DIR, PASTA_SAIDA);

export function ensureArquivos() {
  fs.mkdirSync(ENTRADA_DIR, { recursive: true });
  fs.mkdirSync(SAIDA_DIR, { recursive: true });
}

/** Caminho absoluto dentro da pasta de arquivos, sem deixar escapar dela. */
export function resolveArquivo(rel: string): string | null {
  const full = path.resolve(ARQUIVOS_DIR, rel);
  if (full !== ARQUIVOS_DIR && !full.startsWith(ARQUIVOS_DIR + path.sep)) return null;
  return full;
}

/** URL pública de um arquivo da pasta de arquivos (Para editar / Editadas). */
export function arquivoUrl(rel: string, mini = false): string {
  return "/api/arquivos/" + rel.split("/").map(encodeURIComponent).join("/") + (mini ? "?mini=1" : "");
}

let ensured = false;
export function ensureDirs() {
  if (ensured) return;
  for (const dir of [DATA_DIR, ...Object.values(DIRS)]) fs.mkdirSync(dir, { recursive: true });
  ensured = true;
}

/**
 * Converte um caminho relativo salvo no banco (ex.: "uploads/abc.jpg") em caminho absoluto,
 * garantindo que ele não escape da pasta de dados.
 */
export function resolveDataPath(rel: string): string | null {
  const full = path.resolve(DATA_DIR, rel);
  if (full !== DATA_DIR && !full.startsWith(DATA_DIR + path.sep)) return null;
  return full;
}

/** Caminho relativo (sempre com "/") para guardar no banco e montar URLs. */
export function toRel(...parts: string[]): string {
  return parts.join("/");
}

/** URL pública de um arquivo da pasta de dados. */
export function fileUrl(rel: string): string {
  return "/api/files/" + rel.split("/").map(encodeURIComponent).join("/");
}

export function writeDataFile(rel: string, data: Buffer) {
  const full = resolveDataPath(rel);
  if (!full) throw new Error("Caminho inválido: " + rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, data);
}

export function readDataFile(rel: string): Buffer {
  const full = resolveDataPath(rel);
  if (!full) throw new Error("Caminho inválido: " + rel);
  return fs.readFileSync(/*turbopackIgnore: true*/ full);
}

export function removeDataPath(rel: string) {
  const full = resolveDataPath(rel);
  if (!full || full === DATA_DIR) return;
  fs.rmSync(full, { recursive: true, force: true });
}
