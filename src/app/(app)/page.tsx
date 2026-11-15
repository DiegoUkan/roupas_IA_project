"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { FUNDOS, LIMITES, POSES } from "@/lib/catalog";
import { api, enviarJson, mensagemErro } from "@/lib/client";
import { agrupar, type ModoAgrupamento } from "@/lib/grouping";
import type { BrandModelPublic } from "@/lib/brandModels";
import type { PublicSettings } from "@/lib/settings";

type Foto = {
  key: string;
  file: File;
  preview: string;
  relativePath?: string;
  status: "enviando" | "ok" | "erro";
  uploadId?: string;
  erro?: string;
};

const EXTENSOES = /\.(jpe?g|png|webp|heic|heif)$/i;
const SIMULTANEOS = 3;

export default function GerarPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [modelos, setModelos] = useState<BrandModelPublic[]>([]);

  const [fotos, setFotos] = useState<Foto[]>([]);
  const [modo, setModo] = useState<ModoAgrupamento>("uma");
  const [nomePeca, setNomePeca] = useState("");
  const [poses, setPoses] = useState<string[]>([]);
  const [fundo, setFundo] = useState("");
  const [modeloId, setModeloId] = useState("");
  const [variacoes, setVariacoes] = useState(1);
  const [descricao, setDescricao] = useState("");
  const [arrastando, setArrastando] = useState(false);
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState("");

  const inputFotos = useRef<HTMLInputElement>(null);
  const inputPasta = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputPasta.current?.setAttribute("webkitdirectory", "");
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

  function atualizarFoto(key: string, patch: Partial<Foto>) {
    setFotos((prev) => prev.map((f) => (f.key === key ? { ...f, ...patch } : f)));
  }

  async function enviarFoto(foto: Foto) {
    try {
      const form = new FormData();
      form.append("file", foto.file);
      const r = await api<{ id: string }>("/api/uploads", { method: "POST", body: form });
      atualizarFoto(foto.key, { status: "ok", uploadId: r.id });
    } catch (e) {
      atualizarFoto(foto.key, { status: "erro", erro: mensagemErro(e) });
    }
  }

  function adicionar(lista: FileList | File[], deUmaPasta: boolean) {
    const arquivos = Array.from(lista).filter((f) => f.type.startsWith("image/") || EXTENSOES.test(f.name));
    if (arquivos.length === 0) return;
    const novas: Foto[] = arquivos.map((file) => ({
      key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`,
      file,
      preview: URL.createObjectURL(file),
      relativePath: file.webkitRelativePath || undefined,
      status: "enviando",
    }));
    setFotos((prev) => [...prev, ...novas]);
    if (deUmaPasta || arquivos.length > 1) {
      // Várias fotos com nomes no padrão CODIGO_1.jpg → já sugere separar pelo nome.
      const noPadrao = arquivos.filter((f) => /_[^_]+\.[a-z0-9]+$/i.test(f.name)).length;
      if (deUmaPasta || noPadrao === arquivos.length) setModo("nome");
    }
    let i = 0;
    const trabalhador = async () => {
      while (i < novas.length) await enviarFoto(novas[i++]);
    };
    Promise.all(Array.from({ length: SIMULTANEOS }, trabalhador));
  }

  function remover(key: string) {
    setFotos((prev) => {
      const f = prev.find((x) => x.key === key);
      if (f) URL.revokeObjectURL(f.preview);
      return prev.filter((x) => x.key !== key);
    });
  }

  function limparFotos() {
    fotos.forEach((f) => URL.revokeObjectURL(f.preview));
    setFotos([]);
  }

  const validas = useMemo(() => fotos.filter((f) => f.status !== "erro"), [fotos]);
  const grupos = useMemo(
    () => agrupar(validas.map((f) => ({ name: f.file.name, relativePath: f.relativePath })), modo, nomePeca),
    [validas, modo, nomePeca],
  );
  const enviandoFotos = fotos.some((f) => f.status === "enviando");
  const totalImagens = grupos.length * poses.length * variacoes;
  const pecaGrande = grupos.find((g) => g.indices.length > LIMITES.fotosPorPecaMax);
  const semChave = settings && settings.provider === "openai" && !settings.hasApiKey;

  async function gerar() {
    setErro("");
    setCriando(true);
    try {
      const body = {
        groups: grupos.map((g) => ({ code: g.code, uploadIds: g.indices.map((i) => validas[i].uploadId!) })),
        poses,
        backgroundId: fundo,
        brandModelId: modeloId || null,
        description: descricao,
        variations: variacoes,
      };
      const { id } = await api<{ id: string }>("/api/batches", enviarJson("POST", body));
      router.push(`/lotes/${id}`);
    } catch (e) {
      setErro(mensagemErro(e));
      setCriando(false);
    }
  }

  function alternarPose(id: string) {
    setPoses((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="titulo">Gerar fotos para o site</h1>
        <p className="ajuda mt-1">Envie as fotos, confira as opções e clique em Gerar. A descrição é opcional.</p>
      </div>

      {semChave && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          A chave da API ainda não foi configurada.{" "}
          <Link href="/configuracoes" className="font-semibold underline">
            Ir para Configurações
          </Link>{" "}
          (ou ative o modo simulação para testar sem custo).
        </div>
      )}
      {settings?.provider === "simulacao" && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
          Modo simulação ativo: nada é cobrado e as imagens saem com a faixa “SIMULAÇÃO”.
        </div>
      )}

      {/* 1. Fotos */}
      <section className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="subtitulo">1. Fotos</h2>
          {fotos.length > 0 && (
            <button className="text-sm text-stone-500 hover:text-stone-800" onClick={limparFotos}>
              Remover todas
            </button>
          )}
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setArrastando(true);
          }}
          onDragLeave={() => setArrastando(false)}
          onDrop={(e) => {
            e.preventDefault();
            setArrastando(false);
            adicionar(e.dataTransfer.files, false);
          }}
          className={`rounded-2xl border-2 border-dashed p-6 text-center transition ${
            arrastando ? "border-rose-400 bg-rose-50" : "border-stone-300 bg-stone-50"
          }`}
        >
          <p className="text-sm text-stone-600">Arraste as fotos aqui ou</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <button className="btn-primario" onClick={() => inputFotos.current?.click()}>
              Escolher fotos
            </button>
            <button className="btn-secundario" onClick={() => inputPasta.current?.click()}>
              Escolher pasta
            </button>
          </div>
          <input
            ref={inputFotos}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files) adicionar(e.target.files, false);
              e.target.value = "";
            }}
          />
          <input
            ref={inputPasta}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files) adicionar(e.target.files, true);
              e.target.value = "";
            }}
          />
        </div>

        {fotos.length > 0 && (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-8">
            {fotos.map((f) => (
              <li key={f.key} className="group relative overflow-hidden rounded-xl border border-stone-200 bg-stone-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.preview} alt={f.file.name} className="aspect-[3/4] w-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1.5 py-0.5 text-[10px] text-white">
                  {f.file.name}
                </div>
                {f.status === "enviando" && (
                  <div className="absolute inset-0 grid place-items-center bg-white/60 text-xs font-medium text-stone-700">
                    Enviando…
                  </div>
                )}
                {f.status === "erro" && (
                  <div className="absolute inset-0 grid place-items-center bg-red-50/90 p-1 text-center text-[10px] text-red-700" title={f.erro}>
                    Erro no envio
                  </div>
                )}
                <button
                  onClick={() => remover(f.key)}
                  className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-xs text-white"
                  aria-label={`Remover ${f.file.name}`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        {fotos.some((f) => f.status === "erro") && (
          <p className="text-sm text-red-600">
            {fotos.find((f) => f.status === "erro")?.erro} As fotos com erro ficam de fora.
          </p>
        )}
      </section>

      {/* 2. Peças */}
      {validas.length > 0 && (
        <section className="card space-y-4">
          <h2 className="subtitulo">2. Como separar as peças</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            {(
              [
                ["uma", "Uma roupa só", "Todas as fotos são da mesma peça."],
                ["cada", "Cada foto é uma roupa", "Uma peça por foto."],
                ["nome", "Pelo nome do arquivo", "CODIGO_1.jpg, CODIGO_2.jpg… ou uma pasta por peça."],
              ] as const
            ).map(([id, nome, desc]) => (
              <label
                key={id}
                className={`cursor-pointer rounded-xl border p-3 transition ${
                  modo === id ? "border-rose-400 bg-rose-50" : "border-stone-200 hover:bg-stone-50"
                }`}
              >
                <input type="radio" name="modo" className="sr-only" checked={modo === id} onChange={() => setModo(id)} />
                <span className="block text-sm font-semibold text-stone-900">{nome}</span>
                <span className="block text-xs text-stone-500">{desc}</span>
              </label>
            ))}
          </div>

          {modo === "uma" && (
            <div className="max-w-sm">
              <label className="rotulo" htmlFor="nomePeca">
                Nome ou código da peça (opcional)
              </label>
              <input
                id="nomePeca"
                className="campo"
                placeholder="Ex.: VESTIDO-FLORAL"
                value={nomePeca}
                onChange={(e) => setNomePeca(e.target.value)}
              />
            </div>
          )}

          <div>
            <p className="mb-2 text-sm text-stone-600">
              {grupos.length} {grupos.length === 1 ? "peça encontrada" : "peças encontradas"}:
            </p>
            <ul className="flex flex-wrap gap-2">
              {grupos.map((g) => (
                <li key={g.code} className="chip bg-stone-100 text-stone-700">
                  {g.code} · {g.indices.length} {g.indices.length === 1 ? "foto" : "fotos"}
                </li>
              ))}
            </ul>
            {pecaGrande && (
              <p className="mt-2 text-sm text-red-600">
                A peça {pecaGrande.code} tem {pecaGrande.indices.length} fotos; o máximo é {LIMITES.fotosPorPecaMax} por peça.
              </p>
            )}
          </div>
        </section>
      )}

      {/* 3. Opções */}
      <section className="card space-y-5">
        <h2 className="subtitulo">{validas.length > 0 ? "3." : "2."} Opções</h2>

        <div>
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <span className="rotulo mb-0">Poses ({poses.length})</span>
            <button className="text-sm font-medium text-rose-700 hover:underline" onClick={() => settings && setPoses(settings.defaultPoses)}>
              Usar padrão
            </button>
            <button className="text-sm text-stone-500 hover:underline" onClick={() => setPoses(POSES.map((p) => p.id))}>
              Todas
            </button>
            <button className="text-sm text-stone-500 hover:underline" onClick={() => setPoses([])}>
              Limpar
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {POSES.map((p) => {
              const marcada = poses.includes(p.id);
              return (
                <label
                  key={p.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
                    marcada ? "border-rose-400 bg-rose-50 text-rose-900" : "border-stone-200 text-stone-700 hover:bg-stone-50"
                  }`}
                >
                  <input type="checkbox" className="accent-rose-600" checked={marcada} onChange={() => alternarPose(p.id)} />
                  {p.nome}
                </label>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="rotulo" htmlFor="fundo">
              Fundo
            </label>
            <select id="fundo" className="campo" value={fundo} onChange={(e) => setFundo(e.target.value)}>
              {FUNDOS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="rotulo" htmlFor="modelo">
              Modelo da marca (rosto)
            </label>
            <select id="modelo" className="campo" value={modeloId} onChange={(e) => setModeloId(e.target.value)}>
              <option value="">Manter a pessoa da foto</option>
              {modelos.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.isDefault ? " (padrão)" : ""}
                </option>
              ))}
            </select>
            {modelos.length === 0 && (
              <p className="ajuda mt-1">
                <Link href="/modelos" className="underline">
                  Cadastre uma modelo
                </Link>{" "}
                para trocar o rosto.
              </p>
            )}
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
            Descrição (opcional)
          </label>
          <textarea
            id="descricao"
            className="campo min-h-20"
            placeholder="Ex.: vestido de linho, destacar o decote e o caimento da saia"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
          />
        </div>
      </section>

      {/* Ação */}
      <div className="sticky bottom-0 -mx-4 border-t border-stone-200 bg-white/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:rounded-2xl sm:border">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-stone-600">
            {validas.length === 0 ? (
              "Envie pelo menos uma foto."
            ) : (
              <>
                Serão geradas <strong className="text-stone-900">{totalImagens}</strong>{" "}
                {totalImagens === 1 ? "imagem" : "imagens"} ({grupos.length} {grupos.length === 1 ? "peça" : "peças"} × {poses.length}{" "}
                {poses.length === 1 ? "pose" : "poses"}
                {variacoes > 1 ? ` × ${variacoes} variações` : ""}).
              </>
            )}
          </p>
          <button
            className="btn-primario px-6"
            onClick={gerar}
            disabled={criando || enviandoFotos || validas.length === 0 || poses.length === 0 || Boolean(pecaGrande) || !fundo}
          >
            {criando ? "Criando lote…" : enviandoFotos ? "Enviando fotos…" : "Gerar imagens"}
          </button>
        </div>
        {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
      </div>
    </div>
  );
}
