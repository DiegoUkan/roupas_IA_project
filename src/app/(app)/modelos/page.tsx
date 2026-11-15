"use client";

import { useEffect, useRef, useState } from "react";
import type { BrandModelPublic } from "@/lib/brandModels";
import { api, enviarJson, mensagemErro } from "@/lib/client";

type Aba = "fotos" | "ficticia";

export default function ModelosPage() {
  const [modelos, setModelos] = useState<BrandModelPublic[] | null>(null);
  const [aba, setAba] = useState<Aba>("ficticia");
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [trocarCabelo, setTrocarCabelo] = useState(true);
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const inputArquivos = useRef<HTMLInputElement>(null);

  async function carregar() {
    try {
      setModelos(await api<BrandModelPublic[]>("/api/brand-models"));
    } catch (e) {
      setErro(mensagemErro(e));
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  function limparForm() {
    setNome("");
    setDescricao("");
    setArquivos([]);
    setTrocarCabelo(true);
  }

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setSalvando(true);
    try {
      if (aba === "fotos") {
        const form = new FormData();
        form.append("name", nome);
        form.append("description", descricao);
        form.append("swapHair", String(trocarCabelo));
        arquivos.forEach((f) => form.append("files", f));
        await api("/api/brand-models", { method: "POST", body: form });
      } else {
        await api("/api/brand-models/generate", enviarJson("POST", { name: nome, description: descricao, swapHair: trocarCabelo }));
      }
      limparForm();
      await carregar();
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setSalvando(false);
    }
  }

  async function atualizar(id: string, patch: Record<string, unknown>) {
    try {
      await api(`/api/brand-models/${id}`, enviarJson("PATCH", patch));
      await carregar();
    } catch (e) {
      alert(mensagemErro(e));
    }
  }

  async function apagar(m: BrandModelPublic) {
    if (!confirm(`Apagar a modelo "${m.name}"? Lotes antigos continuam com as imagens já geradas.`)) return;
    await api(`/api/brand-models/${m.id}`, { method: "DELETE" });
    await carregar();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="titulo">Modelos da marca</h1>
        <p className="ajuda mt-1">
          O rosto da pessoa nas fotos é trocado pelo da modelo escolhida, para o catálogo ficar uniforme.
        </p>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        Use uma <strong>modelo fictícia</strong> (gerada aqui) ou uma pessoa que <strong>autorizou por escrito</strong> o uso da
        imagem. O provedor de IA pode recusar trocar o rosto por um de pessoa real.
      </div>

      <form onSubmit={criar} className="card space-y-4">
        <h2 className="subtitulo">Nova modelo</h2>
        <div className="flex gap-2">
          {(
            [
              ["ficticia", "Gerar modelo fictícia"],
              ["fotos", "Enviar fotos de referência"],
            ] as const
          ).map(([id, rotulo]) => (
            <button
              key={id}
              type="button"
              onClick={() => setAba(id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                aba === id ? "bg-rose-50 text-rose-700" : "text-stone-600 hover:bg-stone-100"
              }`}
            >
              {rotulo}
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="rotulo" htmlFor="nome">
              Nome
            </label>
            <input id="nome" className="campo" placeholder="Ex.: Ana" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div>
            <label className="rotulo" htmlFor="descricao">
              {aba === "ficticia" ? "Como ela é" : "Observações (opcional)"}
            </label>
            <input
              id="descricao"
              className="campo"
              placeholder={aba === "ficticia" ? "Ex.: mulher brasileira, 28 anos, pele morena, cabelo castanho ondulado" : "Ex.: sorriso leve"}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>
        </div>

        {aba === "fotos" && (
          <div>
            <span className="rotulo">Fotos do rosto (1 a 3, de frente e bem iluminadas)</span>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="btn-secundario" onClick={() => inputArquivos.current?.click()}>
                Escolher fotos
              </button>
              <span className="ajuda">{arquivos.length ? arquivos.map((f) => f.name).join(", ") : "Nenhuma foto escolhida"}</span>
            </div>
            <input
              ref={inputArquivos}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => setArquivos(Array.from(e.target.files ?? []).slice(0, 3))}
            />
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input type="checkbox" className="accent-rose-600" checked={trocarCabelo} onChange={(e) => setTrocarCabelo(e.target.checked)} />
          Trocar também o cabelo (se desmarcado, troca só o rosto)
        </label>

        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <button className="btn-primario" disabled={salvando || !nome.trim() || (aba === "fotos" && arquivos.length === 0)}>
          {salvando ? (aba === "ficticia" ? "Gerando a modelo… (pode levar 1 minuto)" : "Salvando…") : aba === "ficticia" ? "Gerar modelo" : "Salvar modelo"}
        </button>
      </form>

      {modelos && modelos.length === 0 && <p className="ajuda">Nenhuma modelo cadastrada ainda.</p>}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {modelos?.map((m) => (
          <li key={m.id} className="card space-y-3">
            <div className="flex gap-2">
              {m.imageUrls.map((url) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={url} src={url} alt={m.name} className="h-28 w-24 rounded-lg border border-stone-200 object-cover" />
              ))}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-stone-900">{m.name}</p>
                {m.isDefault && <span className="chip bg-rose-100 text-rose-700">Padrão</span>}
              </div>
              {m.description && <p className="text-sm text-stone-500">{m.description}</p>}
            </div>
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                className="accent-rose-600"
                checked={m.swapHair}
                onChange={(e) => atualizar(m.id, { swapHair: e.target.checked })}
              />
              Trocar cabelo também
            </label>
            <div className="flex flex-wrap gap-2">
              {!m.isDefault && (
                <button className="btn-secundario" onClick={() => atualizar(m.id, { isDefault: true })}>
                  Tornar padrão
                </button>
              )}
              <button className="btn-perigo" onClick={() => apagar(m)}>
                Apagar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
