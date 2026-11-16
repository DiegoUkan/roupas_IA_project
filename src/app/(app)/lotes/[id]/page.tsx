"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { detalharLote } from "@/lib/batches";
import { api, dataHora, enviarJson, mensagemErro } from "@/lib/client";

type Lote = NonNullable<ReturnType<typeof detalharLote>>;
type Imagem = Lote["pecas"][number]["imagens"][number];

function proporcaoCss(p: string): string {
  const [w, h] = p.split(":");
  return w && h ? `${w} / ${h}` : "3 / 4";
}

export default function LotePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [lote, setLote] = useState<Lote | null>(null);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    try {
      setLote(await api<Lote>(`/api/batches/${id}`));
      setErro("");
    } catch (e) {
      setErro(mensagemErro(e));
    }
  }, [id]);

  const emAndamento = lote ? lote.contagem.pendente + lote.contagem.gerando > 0 : true;

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    if (!emAndamento) return;
    const t = setInterval(carregar, 2500);
    return () => clearInterval(t);
  }, [emAndamento, carregar]);

  async function refazer(img: Imagem) {
    try {
      await api(`/api/jobs/${img.id}/retry`, { method: "POST" });
      await carregar();
    } catch (e) {
      alert(mensagemErro(e));
    }
  }

  async function revisar(img: Imagem, revisao: "aprovada" | "reprovada" | null) {
    try {
      await api(`/api/jobs/${img.id}/review`, enviarJson("POST", { revisao }));
      await carregar();
    } catch (e) {
      alert(mensagemErro(e));
    }
  }

  async function refazerErros() {
    if (!lote) return;
    const comErro = lote.pecas.flatMap((p) => p.imagens).filter((i) => i.status === "erro");
    for (const img of comErro) await api(`/api/jobs/${img.id}/retry`, { method: "POST" }).catch(() => {});
    await carregar();
  }

  async function apagar() {
    if (!confirm("Apagar este lote e todas as imagens geradas? Não dá para desfazer.")) return;
    await api(`/api/batches/${id}`, { method: "DELETE" });
    router.push("/lotes");
  }

  if (erro && !lote) return <p className="text-red-600">{erro}</p>;
  if (!lote) return <p className="ajuda">Carregando…</p>;

  const c = lote.contagem;
  const progresso = c.total ? Math.round(((c.pronto + c.erro) / c.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/lotes" className="text-sm text-stone-500 hover:underline">
            ← Lotes
          </Link>
          <h1 className="titulo mt-1">Lote de {dataHora(lote.createdAt)}</h1>
          <p className="ajuda mt-1">
            Fundo: {lote.fundo} · Modelo: {lote.modelo ?? "pessoa da foto"} · Proporção {lote.proporcao} · Qualidade {lote.qualidade}
          </p>
          {lote.descricao && <p className="ajuda mt-1">Descrição: “{lote.descricao}”</p>}
          {lote.custoUSD > 0 && <p className="ajuda mt-1">Custo deste lote: US$ {lote.custoUSD.toFixed(3).replace(".", ",")}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {c.pronto > 0 && (
            <a href={`/api/batches/${id}/zip`} className="btn-primario">
              Baixar tudo (ZIP)
            </a>
          )}
          {c.erro > 0 && (
            <button className="btn-secundario" onClick={refazerErros}>
              Tentar de novo os erros ({c.erro})
            </button>
          )}
          <button className="btn-perigo" onClick={apagar}>
            Apagar lote
          </button>
        </div>
      </div>

      <div className="card">
        <div className="mb-2 flex flex-wrap justify-between gap-2 text-sm">
          <span className="font-medium text-stone-800">
            {emAndamento ? "Gerando…" : "Concluído"} {c.pronto} de {c.total} prontas
          </span>
          <span className="text-stone-500">
            {c.gerando > 0 && `${c.gerando} gerando · `}
            {c.pendente > 0 && `${c.pendente} na fila · `}
            {c.erro > 0 && <span className="text-red-600">{c.erro} com erro</span>}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-stone-100">
          <div className="h-full rounded-full bg-rose-500 transition-all" style={{ width: `${progresso}%` }} />
        </div>
        {emAndamento && <p className="ajuda mt-2">Pode fechar esta página: a geração continua no servidor.</p>}
      </div>

      {lote.pecas.map((peca) => (
        <section key={peca.id} className="card space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="subtitulo">{peca.code}</h2>
            {peca.produto && <span className="chip bg-rose-50 text-rose-700">Produto: {peca.produto}</span>}
            <div className="flex gap-1.5">
              {peca.originais.map((url) => (
                <a key={url} href={url} target="_blank" rel="noreferrer" title="Foto original">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="Original" className="h-12 w-9 rounded-md border border-stone-200 object-cover" />
                </a>
              ))}
            </div>
            <span className="ajuda">← originais</span>
          </div>
          {(peca.pasta || peca.fundo || peca.modelo !== undefined || peca.instrucoes) && (
            <div className="space-y-0.5 text-xs text-stone-500">
              {peca.pasta && (
                <p>
                  Pasta: <strong className="text-stone-700">Para editar/{peca.pasta}</strong> → as aprovadas ficam em{" "}
                  <strong className="text-stone-700">Editadas/{peca.pasta}</strong>
                </p>
              )}
              {(peca.fundo || peca.modelo !== undefined) && (
                <p>
                  Opções próprias: {peca.fundo ? `fundo ${peca.fundo}` : ""}
                  {peca.fundo && peca.modelo !== undefined ? " · " : ""}
                  {peca.modelo !== undefined ? `modelo ${peca.modelo ?? "pessoa da foto"}` : ""}
                </p>
              )}
              {peca.instrucoes && <p className="line-clamp-2">Instruções: “{peca.instrucoes}”</p>}
            </div>
          )}

          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {peca.imagens.map((img) => (
              <li key={img.id} className="space-y-1.5">
                <div
                  className={`relative overflow-hidden rounded-xl border bg-stone-100 ${
                    img.revisao === "aprovada"
                      ? "border-emerald-400 ring-2 ring-emerald-200"
                      : img.revisao === "reprovada"
                        ? "border-stone-200 opacity-40 grayscale"
                        : "border-stone-200"
                  }`}
                  style={{ aspectRatio: proporcaoCss(lote.proporcao) }}
                >
                  {img.status === "pronto" && img.url ? (
                    <a href={img.url} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.url} alt={`${peca.code} ${img.pose}`} className="h-full w-full object-cover" />
                      {img.revisao && (
                        <span
                          className={`chip absolute left-2 top-2 ${
                            img.revisao === "aprovada" ? "bg-emerald-600 text-white" : "bg-stone-800 text-white"
                          }`}
                        >
                          {img.revisao === "aprovada" ? "Aprovada" : "Reprovada"}
                        </span>
                      )}
                    </a>
                  ) : img.status === "erro" ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2 bg-red-50 p-3 text-center">
                      <span className="text-sm font-semibold text-red-700">Erro</span>
                      <span className="line-clamp-6 text-xs text-red-700" title={img.erro ?? ""}>
                        {img.erro}
                      </span>
                    </div>
                  ) : (
                    <div
                      className={`flex h-full flex-col items-center justify-center gap-1 p-3 text-center text-sm text-stone-500 ${
                        img.status === "gerando" ? "animate-pulse" : ""
                      }`}
                    >
                      <span className="font-medium">{img.status === "gerando" ? "Gerando…" : "Na fila"}</span>
                      {img.erro && img.status === "pendente" && (
                        <span className="line-clamp-4 text-xs text-amber-700" title={img.erro}>
                          {img.erro}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-medium text-stone-700">
                    {img.pose}
                    {lote.variacoes > 1 ? ` · ${img.variacao}` : ""}
                  </span>
                  <span className="flex shrink-0 gap-2 text-xs">
                    {img.status === "pronto" && img.url && (
                      <a href={`${img.url}?baixar=1`} className="text-rose-700 hover:underline">
                        Baixar
                      </a>
                    )}
                    {(img.status === "pronto" || img.status === "erro") && (
                      <button onClick={() => refazer(img)} className="text-stone-500 hover:text-stone-900 hover:underline">
                        Refazer
                      </button>
                    )}
                  </span>
                </div>
                {img.status === "pronto" && (
                  <div className="flex gap-1.5">
                    {img.revisao === "reprovada" ? (
                      <button
                        onClick={() => revisar(img, null)}
                        className="flex-1 rounded-lg border border-stone-300 px-2 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50"
                      >
                        Restaurar
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => revisar(img, img.revisao === "aprovada" ? null : "aprovada")}
                          className={`flex-1 rounded-lg border px-2 py-1 text-xs font-medium ${
                            img.revisao === "aprovada"
                              ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                              : "border-stone-300 text-stone-700 hover:bg-emerald-50"
                          }`}
                        >
                          ✓ Aprovar
                        </button>
                        <button
                          onClick={() => revisar(img, "reprovada")}
                          className="flex-1 rounded-lg border border-stone-300 px-2 py-1 text-xs font-medium text-stone-700 hover:bg-red-50"
                        >
                          ✕ Reprovar
                        </button>
                      </>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
