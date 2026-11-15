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

export function mensagemErro(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
