// Ajudantes usados só no navegador.

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (res.status === 401 && typeof window !== "undefined" && !url.includes("/api/auth/")) {
    window.location.href = "/entrar";
  }
  if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);
  return data as T;
}

export function enviarJson(method: string, body: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

export function dataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/** "US$ 0,12 (≈ R$ 0,66)" */
export function formatarCusto(usd: number | null | undefined, cotacao: number): string {
  if (usd == null) return "—";
  const us = usd.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: usd < 1 ? 3 : 2 });
  const rs = (usd * cotacao).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return `US$ ${us} (≈ ${rs})`;
}

export type ResumoCustos = {
  cotacao: number;
  porImagemUSD: number | null;
  base: "fixo" | "historico" | null;
  estimativaUSD: number | null;
  mesUSD: number;
  imagensNoMes: number;
};

export function mensagemErro(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
