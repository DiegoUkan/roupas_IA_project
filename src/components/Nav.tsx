"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const LINKS = [
  { href: "/", nome: "Gerar" },
  { href: "/pastas", nome: "Pastas" },
  { href: "/novo-produto", nome: "Novo produto" },
  { href: "/lotes", nome: "Lotes" },
  { href: "/modelos", nome: "Modelos" },
  { href: "/configuracoes", nome: "Configurações" },
];

export default function Nav({ senhaAtiva }: { senhaAtiva: boolean }) {
  const pathname = usePathname();
  const [pendentes, setPendentes] = useState(0);

  useEffect(() => {
    const carregar = () =>
      fetch("/api/pastas/resumo")
        .then((r) => (r.ok ? r.json() : null))
        .then((r) => r && setPendentes(r.pendentes ?? 0))
        .catch(() => {});
    carregar();
    const t = setInterval(carregar, 30000);
    return () => clearInterval(t);
  }, [pathname]);

  async function sair() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/entrar";
  }

  return (
    <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-bold text-stone-900">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-rose-600 text-sm text-white">IA</span>
          Estúdio IA
        </Link>
        <nav className="-mx-1 flex flex-1 gap-1 overflow-x-auto [scrollbar-width:none]">
          {LINKS.map((l) => {
            const ativo = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  ativo ? "bg-rose-50 text-rose-700" : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                }`}
              >
                {l.nome}
                {l.href === "/pastas" && pendentes > 0 && (
                  <span className="grid min-w-5 place-items-center rounded-full bg-rose-600 px-1.5 text-[11px] font-bold leading-5 text-white">
                    {pendentes}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        {senhaAtiva && (
          <button onClick={sair} className="text-sm text-stone-500 hover:text-stone-800">
            Sair
          </button>
        )}
      </div>
    </header>
  );
}
