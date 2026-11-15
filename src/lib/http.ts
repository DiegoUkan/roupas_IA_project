import { estaAutenticado } from "./auth";

export function erroJson(mensagem: string, status = 400) {
  return Response.json({ error: mensagem }, { status });
}

/**
 * Envolve uma rota da API: confere a senha (se ativa) e transforma exceções em JSON legível.
 */
export async function rota(fn: () => Promise<Response> | Response): Promise<Response> {
  if (!(await estaAutenticado())) return erroJson("Acesso não autorizado. Entre com a senha.", 401);
  try {
    return await fn();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[api]", err);
    return erroJson(msg || "Erro inesperado.", 400);
  }
}
