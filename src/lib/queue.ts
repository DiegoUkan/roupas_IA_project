import { randomBytes } from "node:crypto";
import { db, nowIso } from "./db";
import { fundoById, poseById, proporcaoById } from "./catalog";
import { getBrandModel } from "./brandModels";
import { finalizarSaida } from "./images";
import { readDataFile, toRel, writeDataFile } from "./paths";
import { montarPromptEdicao } from "./prompt";
import { getProvider, ProviderError, tamanhoParaApi } from "./providers";
import { getSettings } from "./settings";

const MAX_TENTATIVAS = 3;
const ESPERA_BASE_MS = 15_000;

export type JobRow = {
  id: string;
  batch_id: string;
  item_id: string;
  pose_id: string;
  variation: number;
  position: number;
  status: "pendente" | "gerando" | "pronto" | "erro";
  attempts: number;
  next_attempt_at: number | null;
  error: string | null;
  output_file: string | null;
  usage: string | null;
  created_at: string;
  updated_at: string;
};

type BatchRow = {
  id: string;
  background_id: string;
  brand_model_id: string | null;
  description: string;
  variations: number;
  options: string;
};

type ItemRow = { id: string; code: string; source_images: string };

type EstadoFila = { iniciada: boolean; rodando: number };

const g = globalThis as unknown as { __estudioFila?: EstadoFila };

function estado(): EstadoFila {
  if (!g.__estudioFila) g.__estudioFila = { iniciada: false, rodando: 0 };
  return g.__estudioFila;
}

/** Chamado quando o servidor sobe: tarefas interrompidas voltam para a fila. */
export function iniciarFila() {
  const st = estado();
  if (st.iniciada) return;
  st.iniciada = true;
  db().prepare("UPDATE jobs SET status = 'pendente', updated_at = ? WHERE status = 'gerando'").run(nowIso());
  setTimeout(processarFila, 500);
}

/** Puxa tarefas pendentes até o limite de gerações simultâneas. */
export function processarFila() {
  const st = estado();
  if (!st.iniciada) {
    iniciarFila();
    return;
  }
  const limite = getSettings().concurrency;
  while (st.rodando < limite) {
    const job = pegarProxima();
    if (!job) break;
    st.rodando++;
    executar(job)
      .catch((err) => console.error("[fila] erro inesperado", err))
      .finally(() => {
        st.rodando--;
        processarFila();
      });
  }
}

function pegarProxima(): JobRow | undefined {
  const conn = db();
  const job = conn
    .prepare(
      `SELECT j.* FROM jobs j JOIN batches b ON b.id = j.batch_id
       WHERE j.status = 'pendente' AND (j.next_attempt_at IS NULL OR j.next_attempt_at <= ?)
       ORDER BY b.created_at ASC, j.position ASC LIMIT 1`,
    )
    .get(Date.now()) as JobRow | undefined;
  if (!job) return undefined;
  conn
    .prepare("UPDATE jobs SET status = 'gerando', attempts = attempts + 1, updated_at = ? WHERE id = ?")
    .run(nowIso(), job.id);
  return job;
}

function nomeArquivo(texto: string): string {
  return texto.replace(/[^A-Za-z0-9_-]/g, "") || "PECA";
}

async function executar(job: JobRow) {
  const conn = db();
  try {
    const batch = conn.prepare("SELECT * FROM batches WHERE id = ?").get(job.batch_id) as BatchRow | undefined;
    const item = conn.prepare("SELECT * FROM items WHERE id = ?").get(job.item_id) as ItemRow | undefined;
    if (!batch || !item) return; // lote apagado enquanto esperava

    const pose = poseById(job.pose_id);
    const fundo = fundoById(batch.background_id);
    if (!pose || !fundo) throw new ProviderError("Pose ou fundo não existe mais no catálogo.");

    const opcoes = JSON.parse(batch.options || "{}") as { aspect?: string; quality?: string };
    const settings = getSettings();
    const proporcao = proporcaoById(opcoes.aspect ?? settings.aspect);
    const qualidade = opcoes.quality ?? settings.quality;

    const fotos = (JSON.parse(item.source_images) as string[]).map((rel, i) => ({
      data: readDataFile(rel),
      filename: `peca_${i + 1}.jpg`,
    }));

    const modelo = batch.brand_model_id ? getBrandModel(batch.brand_model_id) : null;
    const referencias = (modelo?.images ?? []).map((rel, i) => ({ data: readDataFile(rel), filename: `modelo_${i + 1}.jpg` }));

    const prompt = montarPromptEdicao({
      pose,
      fundo,
      qtdFotosPeca: fotos.length,
      modelo: modelo
        ? { descricao: modelo.description, trocarCabelo: modelo.swapHair, qtdReferencias: referencias.length }
        : null,
      descricao: batch.description,
    });

    const size =
      settings.provider === "simulacao"
        ? `${proporcao.largura}x${proporcao.altura}`
        : tamanhoParaApi(settings.model, proporcao.largura, proporcao.altura);

    const resultado = await getProvider(settings).edit({
      images: [...fotos, ...referencias],
      prompt,
      size,
      quality: qualidade,
      label: `${item.code} · ${pose.nome}${batch.variations > 1 ? ` · ${job.variation}` : ""}`,
    });

    // O lote pode ter sido apagado (ou a tarefa refeita) durante a geração.
    const atual = conn.prepare("SELECT status FROM jobs WHERE id = ?").get(job.id) as { status: string } | undefined;
    if (!atual || atual.status !== "gerando") return;

    const final = await finalizarSaida(resultado.image, proporcao.largura, proporcao.altura);
    const rel = toRel(
      "outputs",
      batch.id,
      `${nomeArquivo(item.code)}_${pose.id}_${job.variation}-${randomBytes(3).toString("hex")}.jpg`,
    );
    writeDataFile(rel, final);

    conn
      .prepare(
        "UPDATE jobs SET status = 'pronto', output_file = ?, usage = ?, error = NULL, next_attempt_at = NULL, updated_at = ? WHERE id = ?",
      )
      .run(rel, resultado.usage ? JSON.stringify(resultado.usage) : null, nowIso(), job.id);
  } catch (err) {
    const pe = err instanceof ProviderError ? err : null;
    const mensagem = pe ? pe.message : `Erro inesperado: ${err instanceof Error ? err.message : String(err)}`;
    const tentativa = job.attempts + 1;

    if (pe?.retryable && tentativa < MAX_TENTATIVAS) {
      const espera = ESPERA_BASE_MS * 2 ** (tentativa - 1);
      conn
        .prepare("UPDATE jobs SET status = 'pendente', error = ?, next_attempt_at = ?, updated_at = ? WHERE id = ? AND status = 'gerando'")
        .run(`${mensagem} (tentativa ${tentativa} de ${MAX_TENTATIVAS})`, Date.now() + espera, nowIso(), job.id);
      setTimeout(processarFila, espera + 250);
    } else {
      conn
        .prepare("UPDATE jobs SET status = 'erro', error = ?, next_attempt_at = NULL, updated_at = ? WHERE id = ? AND status = 'gerando'")
        .run(mensagem, nowIso(), job.id);
    }
  }
}
