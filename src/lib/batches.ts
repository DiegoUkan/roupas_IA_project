import { db, newId, nowIso, transaction } from "./db";
import { FUNDOS, LIMITES, POSES, fundoById, poseById } from "./catalog";
import { getBrandModel } from "./brandModels";
import { garantirCodigosUnicos, normalizarCodigo } from "./grouping";
import { fileUrl, removeDataPath, toRel } from "./paths";
import { processarFila, type JobRow } from "./queue";
import { getSettings } from "./settings";
import { getUploads } from "./uploads";

export type NovoLote = {
  groups: { code: string; uploadIds: string[] }[];
  poses: string[];
  backgroundId: string;
  brandModelId: string | null;
  description: string;
  variations: number;
};

export function criarLote(input: NovoLote): string {
  const poses = [...new Set(input.poses)].filter((id) => POSES.some((p) => p.id === id));
  if (poses.length === 0) throw new Error("Escolha pelo menos uma pose.");
  if (!FUNDOS.some((f) => f.id === input.backgroundId)) throw new Error("Fundo inválido.");
  if (input.brandModelId && !getBrandModel(input.brandModelId)) throw new Error("Modelo da marca não encontrada.");

  const variations = Math.min(LIMITES.variacoesMax, Math.max(1, Math.round(Number(input.variations) || 1)));
  const validos = (input.groups ?? []).filter((g) => Array.isArray(g.uploadIds) && g.uploadIds.length > 0);
  const codigos = garantirCodigosUnicos(
    validos.map((g, i) => ({ code: normalizarCodigo(String(g.code ?? "")) || `PECA-${i + 1}`, indices: [i] })),
  );
  const groups = validos.map((g, i) => ({
    code: codigos[i].code,
    uploadIds: [...new Set(g.uploadIds.filter((x): x is string => typeof x === "string"))],
  }));

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

    const insItem = conn.prepare("INSERT INTO items (id, batch_id, code, source_images, position) VALUES (?, ?, ?, ?, ?)");
    const insJob = conn.prepare(
      "INSERT INTO jobs (id, batch_id, item_id, pose_id, variation, position, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'pendente', ?, ?)",
    );

    let pos = 0;
    groups.forEach((g, gi) => {
      const itemId = newId();
      insItem.run(itemId, batchId, g.code, JSON.stringify(g.uploadIds.map((id) => uploads.get(id)!.file)), gi);
      for (const poseId of poses) {
        for (let v = 1; v <= variations; v++) insJob.run(newId(), batchId, itemId, poseId, v, pos++, agora, agora);
      }
    });
  });

  processarFila();
  return batchId;
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

export function listarLotes() {
  const rows = db().prepare("SELECT * FROM batches ORDER BY created_at DESC LIMIT 200").all() as BatchRow[];
  return rows.map((b) => {
    const pecas = db().prepare("SELECT code FROM items WHERE batch_id = ? ORDER BY position").all(b.id) as { code: string }[];
    const capa = db()
      .prepare("SELECT output_file FROM jobs WHERE batch_id = ? AND status = 'pronto' ORDER BY position LIMIT 1")
      .get(b.id) as { output_file: string } | undefined;
    return {
      id: b.id,
      createdAt: b.created_at,
      pecas: pecas.map((p) => p.code),
      fundo: fundoById(b.background_id)?.nome ?? b.background_id,
      contagem: contar(b.id),
      capaUrl: capa?.output_file ? fileUrl(capa.output_file) : null,
    };
  });
}

export function detalharLote(id: string) {
  const conn = db();
  const b = conn.prepare("SELECT * FROM batches WHERE id = ?").get(id) as BatchRow | undefined;
  if (!b) return null;
  const items = conn.prepare("SELECT * FROM items WHERE batch_id = ? ORDER BY position").all(id) as {
    id: string;
    code: string;
    source_images: string;
  }[];
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
    pecas: items.map((it) => ({
      id: it.id,
      code: it.code,
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
        })),
    })),
  };
}

export function apagarLote(id: string) {
  db().prepare("DELETE FROM batches WHERE id = ?").run(id);
  removeDataPath(toRel("outputs", id));
}

/** Volta uma imagem (pronta ou com erro) para a fila. */
export function refazerImagem(jobId: string) {
  const conn = db();
  const job = conn.prepare("SELECT * FROM jobs WHERE id = ?").get(jobId) as JobRow | undefined;
  if (!job) throw new Error("Imagem não encontrada.");
  if (job.status === "gerando") throw new Error("Esta imagem já está sendo gerada.");
  if (job.output_file) removeDataPath(job.output_file);
  conn
    .prepare(
      "UPDATE jobs SET status = 'pendente', attempts = 0, error = NULL, output_file = NULL, usage = NULL, next_attempt_at = NULL, updated_at = ? WHERE id = ?",
    )
    .run(nowIso(), jobId);
  processarFila();
}

/** Arquivos prontos de um lote, para montar o ZIP. */
export function arquivosProntos(id: string) {
  return db()
    .prepare(
      `SELECT i.code, j.pose_id, j.variation, j.output_file FROM jobs j JOIN items i ON i.id = j.item_id
       WHERE j.batch_id = ? AND j.status = 'pronto' AND j.output_file IS NOT NULL ORDER BY j.position`,
    )
    .all(id) as { code: string; pose_id: string; variation: number; output_file: string }[];
}
