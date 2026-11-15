import fs from "node:fs";
import path from "node:path";

/** Pasta onde ficam banco, fotos enviadas e imagens geradas. No Docker: /app/data (volume). */
export const DATA_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR || path.join(process.cwd(), "data"));

export const DIRS = {
  uploads: path.join(DATA_DIR, "uploads"),
  outputs: path.join(DATA_DIR, "outputs"),
  modelos: path.join(DATA_DIR, "modelos"),
};

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
