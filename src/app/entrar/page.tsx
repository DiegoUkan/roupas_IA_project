"use client";

import { useState } from "react";
import { api, enviarJson, mensagemErro } from "@/lib/client";

export default function EntrarPage() {
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setCarregando(true);
    try {
      await api("/api/auth/login", enviarJson("POST", { senha }));
      window.location.href = "/";
    } catch (err) {
      setErro(mensagemErro(err));
      setCarregando(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <form onSubmit={entrar} className="card w-full max-w-sm space-y-4">
        <div className="flex items-center gap-2 font-bold text-stone-900">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-rose-600 text-sm text-white">IA</span>
          Estúdio IA
        </div>
        <div>
          <label className="rotulo" htmlFor="senha">
            Senha
          </label>
          <input
            id="senha"
            type="password"
            className="campo"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoFocus
            autoComplete="current-password"
          />
        </div>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <button className="btn-primario w-full" disabled={carregando || !senha}>
          {carregando ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
