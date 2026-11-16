import { db, newId, nowIso } from "./db";
import { LIMITES } from "./catalog";
import { normalizarUpload } from "./images";
import { fileUrl, toRel, writeDataFile } from "./paths";

export type UploadInfo = { id: string; name: string; url: string; width: number; height: number };

type UploadRow = { id: string; file: string; name: string; width: number; height: number };

/** Recebe uma foto, normaliza (rotação, tamanho, JPEG) e guarda em data/uploads. */
export async function salvarUpload(file: File): Promise<UploadInfo> {
  if (file.size > LIMITES.tamanhoArquivoMaxMB * 1024 * 1024) {
    throw new Error(`A foto "${file.name}" passa de ${LIMITES.tamanhoArquivoMaxMB} MB.`);
  }
  return salvarUploadBuffer(Buffer.from(await file.arrayBuffer()), file.name);
}

/** Igual a salvarUpload, mas a partir de bytes (ex.: fotos lidas das pastas). */
export async function salvarUploadBuffer(buf: Buffer, nome: string): Promise<UploadInfo> {
  const { data, width, height } = await normalizarUpload(buf);
  const id = newId();
  const rel = toRel("uploads", `${id}.jpg`);
  writeDataFile(rel, data);
  db()
    .prepare("INSERT INTO uploads (id, file, name, width, height, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, rel, nome.slice(0, 200), width, height, nowIso());
  return { id, name: nome, url: fileUrl(rel), width, height };
}

export function getUploads(ids: string[]): Map<string, UploadRow> {
  const stmt = db().prepare("SELECT id, file, name, width, height FROM uploads WHERE id = ?");
  const map = new Map<string, UploadRow>();
  for (const id of ids) {
    const row = stmt.get(id) as UploadRow | undefined;
    if (row) map.set(id, row);
  }
  return map;
}
