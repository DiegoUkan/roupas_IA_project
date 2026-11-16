import fs from "node:fs";
import path from "node:path";
import { NOME_ARQUIVO_POSE } from "./catalog";
import { DATA_DIR, DIRS, PASTA_SAIDA, ensureArquivos, resolveArquivo } from "./paths";

/** Junta partes de caminho relativo com "/" (formato guardado no banco). */
function rel(...partes: string[]): string {
  return partes.filter(Boolean).join("/");
}

/** Escolhe um nome livre: "Frente.jpg", "Frente 2.jpg", "Frente 3.jpg"... */
function nomeLivre(dirAbs: string, base: string): string {
  let n = 1;
  for (;;) {
    const nome = n === 1 ? `${base}.jpg` : `${base} ${n}.jpg`;
    if (!fs.existsSync(path.join(dirAbs, nome))) return nome;
    n++;
  }
}

/**
 * Copia a imagem pronta para Editadas/<mesmo caminho da pasta de entrada>/<Pose>.jpg.
 * Nunca sobrescreve: se já existir, cria "Pose 2.jpg". Retorna o caminho relativo à pasta de arquivos.
 */
export function exportarParaEditadas(folderPath: string, poseId: string, data: Buffer): string {
  ensureArquivos();
  const dirRel = rel(PASTA_SAIDA, folderPath);
  const dirAbs = resolveArquivo(dirRel);
  if (!dirAbs) throw new Error("Caminho de saída inválido: " + folderPath);
  fs.mkdirSync(dirAbs, { recursive: true });
  const nome = nomeLivre(dirAbs, NOME_ARQUIVO_POSE[poseId] ?? poseId);
  fs.writeFileSync(path.join(/*turbopackIgnore: true*/ dirAbs, nome), data);
  return rel(dirRel, nome);
}

function caminhoLixeira(jobId: string): string {
  return path.join(DIRS.lixeira, `${jobId}.jpg`);
}

/** Tira a imagem da pasta Editadas e guarda na lixeira interna (dá para restaurar). */
export function moverParaLixeira(jobId: string, exportado: string | null) {
  if (!exportado) return;
  const origem = resolveArquivo(exportado);
  if (!origem || !fs.existsSync(origem)) return;
  fs.mkdirSync(DIRS.lixeira, { recursive: true });
  fs.copyFileSync(origem, caminhoLixeira(jobId));
  fs.rmSync(origem, { force: true });
}

/** Devolve da lixeira para Editadas. Se o nome estiver ocupado, usa o próximo livre. Retorna o novo caminho. */
export function restaurarDaLixeira(jobId: string, exportado: string | null): string | null {
  const lixo = caminhoLixeira(jobId);
  if (!exportado || !fs.existsSync(lixo)) return exportado;
  const destino = resolveArquivo(exportado);
  if (!destino) return exportado;
  const dir = path.dirname(destino);
  fs.mkdirSync(dir, { recursive: true });
  let final = destino;
  if (fs.existsSync(/*turbopackIgnore: true*/ final)) {
    const base = path.basename(destino, ".jpg").replace(/ \d+$/, "");
    final = path.join(/*turbopackIgnore: true*/ dir, nomeLivre(dir, base));
  }
  fs.copyFileSync(lixo, final);
  fs.rmSync(lixo, { force: true });
  return path.relative(resolveArquivo("")!, final).split(path.sep).join("/");
}

/** Usado só para garantir que DATA_DIR seja importado antes (pasta da lixeira). */
export const LIXEIRA_DIR = path.join(DATA_DIR, "lixeira");
