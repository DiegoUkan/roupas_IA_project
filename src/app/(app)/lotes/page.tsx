"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { listarLotes } from "@/lib/batches";
import { api, dataHora, mensagemErro } from "@/lib/client";

type Resumo = ReturnType<typeof listarLotes>[number];

export default function LotesPage() {
  const [lotes, setLotes] = useState<Resumo[] | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    const carregar = () =>
      api<Resumo[]>("/api/batches")
        .then(setLotes)
        .catch((e) => setErro(mensagemErro(e)));
    carregar();
    const t = setInterval(carregar, 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="titulo">Lotes</h1>
          <p className="ajuda mt-1">Todas as gerações feitas, das mais novas para as mais antigas.</p>
        </div>
        <Link href="/" className="btn-primario">
          Nova geração
        </Link>
      </div>

      {erro && <p className="text-red-600">{erro}</p>}
      {lotes && lotes.length === 0 && (
        <div className="card text-center text-stone-500">
          Nenhum lote ainda.{" "}
          <Link href="/" className="font-medium text-rose-700 underline">
            Gerar as primeiras fotos
          </Link>
        </div>
      )}

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {lotes?.map((l) => {
          const c = l.contagem;
          const andamento = c.pendente + c.gerando > 0;
          return (
            <li key={l.id}>
              <Link href={`/lotes/${l.id}`} className="card flex gap-4 transition hover:border-rose-300">
                <div className="h-24 w-[72px] shrink-0 overflow-hidden rounded-lg bg-stone-100">
                  {l.capaUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.capaUrl} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 space-y-1">
                  <p className="font-semibold text-stone-900">{dataHora(l.createdAt)}</p>
                  <p className="truncate text-sm text-stone-600">
                    {l.pecas.slice(0, 3).join(", ")}
                    {l.pecas.length > 3 ? ` +${l.pecas.length - 3}` : ""}
                  </p>
                  <p className="text-xs text-stone-500">{l.fundo}</p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span className={`chip ${andamento ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                      {c.pronto}/{c.total} prontas
                    </span>
                    {c.erro > 0 && <span className="chip bg-red-100 text-red-700">{c.erro} erro</span>}
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
