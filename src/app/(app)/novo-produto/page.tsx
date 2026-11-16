"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, mensagemErro } from "@/lib/client";

type Foto = { key: string; file: File; preview: string };

const NOVA = "__nova";

export default function NovoProdutoPage() {
  const router = useRouter();
  const [categorias, setCategorias] = useState<string[]>([]);
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [novaCategoria, setNovaCategoria] = useState("");
  const [instrucoes, setInstrucoes] = useState("");
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [gerarAgora, setGerarAgora] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState<string | null>(null);
  const inputCamera = useRef<HTMLInputElement>(null);
  const inputGaleria = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<string[]>("/api/pastas/categorias")
      .then(setCategorias)
      .catch(() => setCategorias([]));
  }, []);

  function adicionar(lista: FileList | null) {
    if (!lista) return;
    const novas = Array.from(lista)
      .filter((f) => f.type.startsWith("image/"))
      .map((file) => ({ key: `${file.name}-${Math.random().toString(36).slice(2)}`, file, preview: URL.createObjectURL(file) }));
    setFotos((prev) => [...prev, ...novas]);
  }

  function remover(key: string) {
    setFotos((prev) => {
      const f = prev.find((x) => x.key === key);
      if (f) URL.revokeObjectURL(f.preview);
      return prev.filter((x) => x.key !== key);
    });
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setEnviando(true);
    try {
      const form = new FormData();
      form.append("nome", nome);
      form.append("categoria", categoria === NOVA ? novaCategoria : categoria);
      form.append("instrucoes", instrucoes);
      form.append("gerarAgora", String(gerarAgora));
      fotos.forEach((f) => form.append("files", f.file));
      const r = await api<{ caminho: string; loteId: string | null }>("/api/pastas/novo", { method: "POST", body: form });
      fotos.forEach((f) => URL.revokeObjectURL(f.preview));
      if (r.loteId) {
        router.push(`/lotes/${r.loteId}`);
        return;
      }
      setFeito(r.caminho);
      setNome("");
      setInstrucoes("");
      setFotos([]);
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/pastas" className="text-sm text-stone-500 hover:underline">
          ← Pastas
        </Link>
        <h1 className="titulo mt-1">Novo produto</h1>
        <p className="ajuda mt-1">Tire as fotos, dê um nome e pronto: o sistema cria a pasta do produto em “Para editar”.</p>
      </div>

      {feito && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          Produto salvo em “Para editar/{feito}”. Ele aparece em{" "}
          <Link href="/pastas" className="font-semibold underline">
            Pastas
          </Link>{" "}
          para gerar quando quiser.
        </div>
      )}

      <form onSubmit={salvar} className="card space-y-5">
        <div>
          <label className="rotulo" htmlFor="nome">
            Nome do produto (vira o nome da pasta)
          </label>
          <input
            id="nome"
            className="campo"
            placeholder="Ex.: Vestido floral azul"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="rotulo" htmlFor="categoria">
              Pasta / categoria
            </label>
            <select id="categoria" className="campo" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              <option value="">Nenhuma (direto em “Para editar”)</option>
              {categorias.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value={NOVA}>+ Nova categoria…</option>
            </select>
          </div>
          {categoria === NOVA && (
            <div>
              <label className="rotulo" htmlFor="novaCategoria">
                Nome da nova categoria
              </label>
              <input
                id="novaCategoria"
                className="campo"
                placeholder="Ex.: Verão/Vestidos"
                value={novaCategoria}
                onChange={(e) => setNovaCategoria(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="space-y-3">
          <span className="rotulo">Fotos</span>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primario" onClick={() => inputCamera.current?.click()}>
              Tirar foto
            </button>
            <button type="button" className="btn-secundario" onClick={() => inputGaleria.current?.click()}>
              Escolher da galeria
            </button>
          </div>
          <input
            ref={inputCamera}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => {
              adicionar(e.target.files);
              e.target.value = "";
            }}
          />
          <input
            ref={inputGaleria}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              adicionar(e.target.files);
              e.target.value = "";
            }}
          />
          {fotos.length > 0 && (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {fotos.map((f) => (
                <li key={f.key} className="relative overflow-hidden rounded-xl border border-stone-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.preview} alt={f.file.name} className="aspect-[3/4] w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => remover(f.key)}
                    className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-xs text-white"
                    aria-label="Remover foto"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <label className="rotulo" htmlFor="instrucoes">
            Instruções para este produto (opcional, vira o prompt.txt)
          </label>
          <textarea
            id="instrucoes"
            className="campo min-h-20"
            placeholder="Ex.: o produto é só a blusa; mostrar bem o bordado"
            value={instrucoes}
            onChange={(e) => setInstrucoes(e.target.value)}
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input type="checkbox" className="accent-rose-600" checked={gerarAgora} onChange={(e) => setGerarAgora(e.target.checked)} />
          Já gerar as imagens com as opções padrão
        </label>

        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <button className="btn-primario w-full sm:w-auto" disabled={enviando || !nome.trim() || fotos.length === 0}>
          {enviando ? "Enviando…" : gerarAgora ? "Salvar e gerar" : "Salvar na pasta"}
        </button>
      </form>
    </div>
  );
}
