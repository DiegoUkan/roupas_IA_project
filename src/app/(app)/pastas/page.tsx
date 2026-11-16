"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EstimativaCusto, SeletorFundo, SeletorModelo, SeletorPoses } from "@/components/Opcoes";
import { LIMITES } from "@/lib/catalog";
import { api, dataHora, enviarJson, mensagemErro } from "@/lib/client";
import type { BrandModelPublic } from "@/lib/brandModels";
import type { listarPastas, resumo } from "@/lib/pastas";
import type { PublicSettings } from "@/lib/settings";

type Pasta = ReturnType<typeof listarPastas>[number];
type Resumo = ReturnType<typeof resumo>;

type Edicao = {
  produto: string;
  instrucoes: string;
  verInstrucoes: boolean;
  personalizar: boolean;
  poses: string[];
  fundo: string; // "" = do lote
  modelo: string; // "__herdar" | "" | id
};

const STATUS: Record<Pasta["status"], { texto: (p: Pasta) => string; cor: string }> = {
  novo: { texto: () => "Novo", cor: "bg-emerald-100 text-emerald-800" },
  "fotos-novas": { texto: (p) => `${p.novas} ${p.novas === 1 ? "foto nova" : "fotos novas"}`, cor: "bg-amber-100 text-amber-800" },
  copiando: { texto: () => "Copiando…", cor: "bg-stone-100 text-stone-600" },
  processado: { texto: () => "Processado", cor: "bg-stone-100 text-stone-600" },
  ignorado: { texto: () => "Ignorado", cor: "bg-stone-100 text-stone-500" },
};

const selecionavel = (p: Pasta) => p.status !== "copiando";

export default function PastasPage() {
  const router = useRouter();
  const [pastas, setPastas] = useState<Pasta[] | null>(null);
  const [info, setInfo] = useState<Resumo | null>(null);
  const [todas, setTodas] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [edicoes, setEdicoes] = useState<Record<string, Edicao>>({});
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [modelos, setModelos] = useState<BrandModelPublic[]>([]);
  const [poses, setPoses] = useState<string[]>([]);
  const [fundo, setFundo] = useState("");
  const [modeloId, setModeloId] = useState("");
  const [variacoes, setVariacoes] = useState(1);
  const [descricao, setDescricao] = useState("");
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState("");

  const carregar = useCallback(
    async (marcarNovos: boolean) => {
      try {
        const r = await api<{ pastas: Pasta[]; resumo: Resumo }>(`/api/pastas${todas ? "?todas=1" : ""}`);
        setPastas(r.pastas);
        setInfo(r.resumo);
        setEdicoes((prev) => {
          const novo = { ...prev };
          for (const p of r.pastas) {
            if (!novo[p.caminho]) {
              novo[p.caminho] = {
                produto: p.nome,
                instrucoes: p.promptTxt ?? "",
                verInstrucoes: Boolean(p.promptTxt),
                personalizar: false,
                poses: [],
                fundo: "",
                modelo: "__herdar",
              };
            }
          }
          return novo;
        });
        if (marcarNovos) {
          setSelecionados(new Set(r.pastas.filter((p) => p.status === "novo" || p.status === "fotos-novas").map((p) => p.caminho)));
        }
      } catch (e) {
        setErro(mensagemErro(e));
      }
    },
    [todas],
  );

  useEffect(() => {
    Promise.all([api<PublicSettings>("/api/settings"), api<BrandModelPublic[]>("/api/brand-models")])
      .then(([s, m]) => {
        setSettings(s);
        setPoses(s.defaultPoses);
        setFundo(s.defaultBackground);
        setVariacoes(s.variations);
        setModelos(m);
        setModeloId(m.find((x) => x.isDefault)?.id ?? "");
      })
      .catch((e) => setErro(mensagemErro(e)));
  }, []);

  useEffect(() => {
    carregar(true);
    const t = setInterval(() => carregar(false), 20000);
    return () => clearInterval(t);
  }, [carregar]);

  async function verificar() {
    setVerificando(true);
    try {
      await api("/api/pastas/varrer", { method: "POST" });
      await carregar(true);
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setVerificando(false);
    }
  }

  function editar(caminho: string, patch: Partial<Edicao>) {
    setEdicoes((prev) => ({ ...prev, [caminho]: { ...prev[caminho], ...patch } }));
  }

  function alternar(caminho: string) {
    setSelecionados((prev) => {
      const s = new Set(prev);
      if (s.has(caminho)) s.delete(caminho);
      else s.add(caminho);
      return s;
    });
  }

  async function ignorar(p: Pasta, valor: boolean) {
    await api("/api/pastas/ignorar", enviarJson("POST", { caminho: p.caminho, ignorar: valor }));
    setSelecionados((prev) => {
      const s = new Set(prev);
      s.delete(p.caminho);
      return s;
    });
    await carregar(false);
  }

  const escolhidos = useMemo(
    () => (pastas ?? []).filter((p) => selecionados.has(p.caminho) && selecionavel(p)),
    [pastas, selecionados],
  );

  const totalImagens = escolhidos.reduce((n, p) => {
    const e = edicoes[p.caminho];
    const qtdPoses = e?.personalizar && e.poses.length ? e.poses.length : poses.length;
    return n + qtdPoses * variacoes;
  }, 0);

  async function gerar() {
    setErro("");
    setCriando(true);
    try {
      const produtos = escolhidos.map((p) => {
        const e = edicoes[p.caminho];
        const item: Record<string, unknown> = { caminho: p.caminho, produto: e?.produto ?? p.nome, instrucoes: e?.instrucoes ?? "" };
        if (e?.personalizar) {
          if (e.poses.length) item.poses = e.poses;
          if (e.fundo) item.backgroundId = e.fundo;
          if (e.modelo !== "__herdar") item.brandModelId = e.modelo === "" ? null : e.modelo;
        }
        return item;
      });
      const { id } = await api<{ id: string }>(
        "/api/pastas/gerar",
        enviarJson("POST", {
          produtos,
          padrao: { poses, backgroundId: fundo, brandModelId: modeloId || null, variations: variacoes, description: descricao },
        }),
      );
      router.push(`/lotes/${id}`);
    } catch (e) {
      setErro(mensagemErro(e));
      setCriando(false);
    }
  }

  const semPoses = escolhidos.some((p) => {
    const e = edicoes[p.caminho];
    return !(e?.personalizar && e.poses.length) && poses.length === 0;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="titulo">Pastas</h1>
          <p className="ajuda mt-1">
            Coloque cada produto numa pasta dentro de <strong>{info?.pastaEntrada ?? "Para editar"}</strong>. As imagens prontas
            vão para <strong>{info?.pastaSaida ?? "Editadas"}</strong>, no mesmo caminho.
          </p>
          {info && (
            <p className="ajuda mt-1">
              Última verificação: {info.ultimaVarredura ? dataHora(info.ultimaVarredura) : "ainda não"} · verifica sozinho a
              cada minuto{info.autoMode ? " · modo automático LIGADO" : ""}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/novo-produto" className="btn-secundario">
            + Novo produto
          </Link>
          <button className="btn-secundario" onClick={verificar} disabled={verificando}>
            {verificando ? "Verificando…" : "Verificar agora"}
          </button>
        </div>
      </div>

      {info && info.fotosSoltas > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Há {info.fotosSoltas} {info.fotosSoltas === 1 ? "foto solta" : "fotos soltas"} direto em “{info.pastaEntrada}”. Coloque
          cada produto dentro de uma pasta com o nome dele para o sistema encontrar.
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input type="checkbox" className="accent-rose-600" checked={todas} onChange={(e) => setTodas(e.target.checked)} />
          Mostrar também os já processados e ignorados
        </label>
        {pastas && pastas.length > 0 && (
          <div className="flex gap-3 text-sm">
            <button
              className="text-rose-700 hover:underline"
              onClick={() => setSelecionados(new Set(pastas.filter(selecionavel).map((p) => p.caminho)))}
            >
              Selecionar todos
            </button>
            <button className="text-stone-500 hover:underline" onClick={() => setSelecionados(new Set())}>
              Nenhum
            </button>
          </div>
        )}
      </div>

      {pastas && pastas.length === 0 && (
        <div className="card space-y-2 text-center text-stone-600">
          <p>Nenhuma imagem nova nas pastas.</p>
          <p className="ajuda">
            Crie uma pasta por produto dentro de “{info?.pastaEntrada ?? "Para editar"}” (pode organizar em subpastas, ex.:
            Verão/Vestidos/Vestido floral azul) ou use{" "}
            <Link href="/novo-produto" className="text-rose-700 underline">
              Novo produto
            </Link>
            .
          </p>
        </div>
      )}

      <ul className="space-y-3">
        {pastas?.map((p) => {
          const e = edicoes[p.caminho];
          const marcado = selecionados.has(p.caminho);
          const st = STATUS[p.status];
          return (
            <li key={p.caminho} className={`card space-y-3 ${marcado ? "border-rose-300 ring-1 ring-rose-200" : ""}`}>
              <div className="flex flex-wrap items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 h-5 w-5 accent-rose-600"
                  checked={marcado}
                  disabled={!selecionavel(p)}
                  onChange={() => alternar(p.caminho)}
                  aria-label={`Selecionar ${p.nome}`}
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-stone-900">{p.nome}</span>
                    <span className={`chip ${st.cor}`}>{st.texto(p)}</span>
                    {p.editadas > 0 && <span className="chip bg-sky-50 text-sky-700">{p.editadas} em Editadas</span>}
                  </div>
                  <p className="truncate text-xs text-stone-500">
                    {p.categoria ? `${p.categoria} / ` : ""}
                    {p.nome} · {p.totalFotos} {p.totalFotos === 1 ? "foto" : "fotos"}
                    {p.totalFotos > LIMITES.fotosPorPecaMax ? ` (usa as ${LIMITES.fotosPorPecaMax} primeiras)` : ""}
                    {p.ultimoLote && (
                      <>
                        {" · "}
                        <Link href={`/lotes/${p.ultimoLote}`} className="underline">
                          último lote
                        </Link>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex gap-2 text-xs">
                  {p.status === "ignorado" ? (
                    <button className="text-stone-500 hover:underline" onClick={() => ignorar(p, false)}>
                      Mostrar de novo
                    </button>
                  ) : (
                    p.status !== "processado" && (
                      <button className="text-stone-500 hover:underline" onClick={() => ignorar(p, true)}>
                        Ignorar
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1">
                {p.fotos.map((f) => (
                  <a key={f.nome} href={f.url} target="_blank" rel="noreferrer" className="shrink-0" title={f.nome}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.mini} alt={f.nome} loading="lazy" className="h-24 w-18 rounded-lg border border-stone-200 object-cover" />
                  </a>
                ))}
              </div>

              {e && (
                <div className="space-y-3">
                  <div>
                    <label className="rotulo" htmlFor={`prod-${p.caminho}`}>
                      O que está à venda
                    </label>
                    <input
                      id={`prod-${p.caminho}`}
                      className="campo"
                      value={e.produto}
                      onChange={(ev) => editar(p.caminho, { produto: ev.target.value })}
                    />
                  </div>

                  <div className="flex flex-wrap gap-4 text-sm">
                    <button
                      className="font-medium text-rose-700 hover:underline"
                      onClick={() => editar(p.caminho, { verInstrucoes: !e.verInstrucoes })}
                    >
                      {e.verInstrucoes ? "Esconder instruções" : p.promptTxt ? "Ver instruções (prompt.txt)" : "+ Instruções deste produto"}
                    </button>
                    <button
                      className="font-medium text-rose-700 hover:underline"
                      onClick={() =>
                        editar(p.caminho, {
                          personalizar: !e.personalizar,
                          poses: e.poses.length ? e.poses : poses,
                        })
                      }
                    >
                      {e.personalizar ? "Usar opções do lote" : "Personalizar poses/fundo/modelo"}
                    </button>
                  </div>

                  {e.verInstrucoes && (
                    <div>
                      <textarea
                        className="campo min-h-20"
                        placeholder="Ex.: mostrar bem o bordado da gola; usar com calça jeans clara"
                        value={e.instrucoes}
                        onChange={(ev) => editar(p.caminho, { instrucoes: ev.target.value })}
                      />
                      <p className="ajuda mt-1">
                        {p.promptTxt ? "Veio do prompt.txt da pasta. " : ""}Vale só para este produto, junto com as diretrizes da loja.
                      </p>
                    </div>
                  )}

                  {e.personalizar && (
                    <div className="space-y-3 rounded-xl border border-stone-200 bg-stone-50 p-3">
                      <SeletorPoses valor={e.poses} onChange={(v) => editar(p.caminho, { poses: v })} padrao={poses} compacto />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="rotulo" htmlFor={`fundo-${p.caminho}`}>
                            Fundo
                          </label>
                          <SeletorFundo
                            id={`fundo-${p.caminho}`}
                            valor={e.fundo}
                            onChange={(v) => editar(p.caminho, { fundo: v })}
                            opcaoHerdar="Igual ao padrão do lote"
                          />
                        </div>
                        <div>
                          <label className="rotulo" htmlFor={`modelo-${p.caminho}`}>
                            Modelo da marca
                          </label>
                          <SeletorModelo
                            id={`modelo-${p.caminho}`}
                            valor={e.modelo}
                            onChange={(v) => editar(p.caminho, { modelo: v })}
                            modelos={modelos}
                            permitirHerdar
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {pastas && pastas.length > 0 && (
        <section className="card space-y-4">
          <h2 className="subtitulo">Opções padrão do lote</h2>
          <SeletorPoses valor={poses} onChange={setPoses} padrao={settings?.defaultPoses} />
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="rotulo" htmlFor="fundo">
                Fundo
              </label>
              <SeletorFundo id="fundo" valor={fundo} onChange={setFundo} />
            </div>
            <div>
              <label className="rotulo" htmlFor="modelo">
                Modelo da marca
              </label>
              <SeletorModelo id="modelo" valor={modeloId} onChange={setModeloId} modelos={modelos} />
            </div>
            <div>
              <label className="rotulo" htmlFor="variacoes">
                Variações por pose
              </label>
              <select id="variacoes" className="campo" value={variacoes} onChange={(e) => setVariacoes(Number(e.target.value))}>
                {Array.from({ length: LIMITES.variacoesMax }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="rotulo" htmlFor="descricao">
              Descrição para todo o lote (opcional)
            </label>
            <textarea id="descricao" className="campo min-h-16" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
        </section>
      )}

      {pastas && pastas.length > 0 && (
        <div className="sticky bottom-0 -mx-4 border-t border-stone-200 bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <p className="text-sm text-stone-600">
                {escolhidos.length === 0 ? (
                  "Selecione os produtos que quer gerar."
                ) : (
                  <>
                    <strong className="text-stone-900">{escolhidos.length}</strong> {escolhidos.length === 1 ? "produto" : "produtos"} ·{" "}
                    <strong className="text-stone-900">{totalImagens}</strong> {totalImagens === 1 ? "imagem" : "imagens"}
                  </>
                )}
              </p>
              <EstimativaCusto imagens={totalImagens} />
            </div>
            <button
              className="btn-primario px-6"
              onClick={gerar}
              disabled={criando || escolhidos.length === 0 || semPoses || !fundo}
            >
              {criando ? "Preparando…" : "Gerar selecionados"}
            </button>
          </div>
          {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
        </div>
      )}
    </div>
  );
}
