import { NextResponse } from "next/server";
import { COOKIE_SESSAO, senhaAtiva, senhaCorreta, tokenSessao } from "@/lib/auth";

export async function POST(req: Request) {
  if (!senhaAtiva()) return NextResponse.json({ ok: true });
  const body = (await req.json().catch(() => ({}))) as { senha?: unknown };
  if (!senhaCorreta(String(body.senha ?? ""))) {
    return NextResponse.json({ error: "Senha incorreta." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  const https = req.headers.get("x-forwarded-proto") === "https" || new URL(req.url).protocol === "https:";
  res.cookies.set(COOKIE_SESSAO, tokenSessao(), {
    httpOnly: true,
    sameSite: "lax",
    secure: https,
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
  return res;
}
