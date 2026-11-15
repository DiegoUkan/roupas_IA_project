import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const COOKIE_SESSAO = "estudio_sessao";

/** A senha é opcional: só fica ativa se a variável APP_PASSWORD estiver definida. */
export function senhaAtiva(): boolean {
  return Boolean(process.env.APP_PASSWORD);
}

function tokenEsperado(): string {
  return createHmac("sha256", process.env.APP_PASSWORD || "").update("estudio-ia-sessao-v1").digest("hex");
}

function iguais(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function senhaCorreta(senha: string): boolean {
  return senhaAtiva() && iguais(senha, process.env.APP_PASSWORD || "");
}

export function tokenSessao(): string {
  return tokenEsperado();
}

export async function estaAutenticado(): Promise<boolean> {
  // Ler os cookies sempre (mesmo sem senha) mantém as páginas dinâmicas: a senha
  // vem do ambiente na hora de rodar, não na hora do build.
  const store = await cookies();
  if (!senhaAtiva()) return true;
  const valor = store.get(COOKIE_SESSAO)?.value;
  return Boolean(valor) && iguais(valor!, tokenEsperado());
}
