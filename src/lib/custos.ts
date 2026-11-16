import { db } from "./db";
import { getSettings, type Settings } from "./settings";

type Uso = { input_tokens?: number; output_tokens?: number } | null | undefined;

/** Custo de uma imagem em US$, pelos tokens informados pela API ou pelo valor fixo. */
export function calcularCusto(uso: Uso, s: Settings = getSettings()): number | null {
  if (s.custoFixoUSD > 0) return s.custoFixoUSD;
  if (!uso || (uso.input_tokens == null && uso.output_tokens == null)) return null;
  const entrada = (uso.input_tokens ?? 0) * (s.precoEntradaMilhao / 1_000_000);
  const saida = (uso.output_tokens ?? 0) * (s.precoSaidaMilhao / 1_000_000);
  return Math.round((entrada + saida) * 10000) / 10000;
}

/** Custo médio por imagem: valor fixo, ou média das últimas imagens geradas. */
export function custoMedioPorImagem(): { valor: number | null; base: "fixo" | "historico" | null } {
  const s = getSettings();
  if (s.custoFixoUSD > 0) return { valor: s.custoFixoUSD, base: "fixo" };
  const row = db()
    .prepare(
      "SELECT AVG(cost_usd) AS media, COUNT(*) AS n FROM (SELECT cost_usd FROM jobs WHERE cost_usd IS NOT NULL ORDER BY updated_at DESC LIMIT 30)",
    )
    .get() as { media: number | null; n: number };
  if (!row.n || row.media == null) return { valor: null, base: null };
  return { valor: row.media, base: "historico" };
}

function inicioDoMes(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

export function resumoCustos(qtdImagens = 0) {
  const s = getSettings();
  const media = custoMedioPorImagem();
  const mes = db()
    .prepare("SELECT COALESCE(SUM(cost_usd), 0) AS total, COUNT(cost_usd) AS n FROM jobs WHERE status = 'pronto' AND updated_at >= ?")
    .get(inicioDoMes()) as { total: number; n: number };
  return {
    cotacao: s.cotacaoDolar,
    porImagemUSD: media.valor,
    base: media.base,
    estimativaUSD: media.valor != null ? media.valor * qtdImagens : null,
    mesUSD: mes.total,
    imagensNoMes: mes.n,
  };
}
