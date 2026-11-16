"use client";

import { useEffect, useState } from "react";
import { FUNDOS, POSES } from "@/lib/catalog";
import { api, formatarCusto, type ResumoCustos } from "@/lib/client";
import type { BrandModelPublic } from "@/lib/brandModels";

export function SeletorPoses({
  valor,
  onChange,
  padrao,
  compacto = false,
}: {
  valor: string[];
  onChange: (v: string[]) => void;
  padrao?: string[];
  compacto?: boolean;
}) {
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <span className="rotulo mb-0">Poses ({valor.length})</span>
        {padrao && (
          <button type="button" className="text-sm font-medium text-rose-700 hover:underline" onClick={() => onChange(padrao)}>
            Usar padrão
          </button>
        )}
        <button type="button" className="text-sm text-stone-500 hover:underline" onClick={() => onChange(POSES.map((p) => p.id))}>
          Todas
        </button>
        <button type="button" className="text-sm text-stone-500 hover:underline" onClick={() => onChange([])}>
          Limpar
        </button>
      </div>
      <div className={`grid gap-2 ${compacto ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"}`}>
        {POSES.map((p) => {
          const marcada = valor.includes(p.id);
          return (
            <label
              key={p.id}
              className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
                marcada ? "border-rose-400 bg-rose-50 text-rose-900" : "border-stone-200 text-stone-700 hover:bg-stone-50"
              }`}
            >
              <input
                type="checkbox"
                className="accent-rose-600"
                checked={marcada}
                onChange={() => onChange(marcada ? valor.filter((x) => x !== p.id) : [...valor, p.id])}
              />
              {p.nome}
            </label>
          );
        })}
      </div>
    </div>
  );
}

export function SeletorFundo({
  id,
  valor,
  onChange,
  opcaoHerdar,
}: {
  id: string;
  valor: string;
  onChange: (v: string) => void;
  /** Texto da opção "usar o do lote" (valor ""). */
  opcaoHerdar?: string;
}) {
  return (
    <select id={id} className="campo" value={valor} onChange={(e) => onChange(e.target.value)}>
      {opcaoHerdar && <option value="">{opcaoHerdar}</option>}
      {FUNDOS.map((f) => (
        <option key={f.id} value={f.id}>
          {f.nome}
        </option>
      ))}
    </select>
  );
}

/** valor: id da modelo, "" = manter a pessoa da foto, "__herdar" = usar a do lote. */
export function SeletorModelo({
  id,
  valor,
  onChange,
  modelos,
  permitirHerdar = false,
}: {
  id: string;
  valor: string;
  onChange: (v: string) => void;
  modelos: BrandModelPublic[];
  permitirHerdar?: boolean;
}) {
  return (
    <select id={id} className="campo" value={valor} onChange={(e) => onChange(e.target.value)}>
      {permitirHerdar && <option value="__herdar">Igual ao padrão do lote</option>}
      <option value="">Manter a pessoa da foto</option>
      {modelos.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
          {m.isDefault ? " (padrão)" : ""}
        </option>
      ))}
    </select>
  );
}

/** Mostra "≈ US$ x (R$ y)" para N imagens, com base no histórico ou no valor fixo. */
export function EstimativaCusto({ imagens }: { imagens: number }) {
  const [c, setC] = useState<ResumoCustos | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      api<ResumoCustos>(`/api/custos?imagens=${imagens}`)
        .then(setC)
        .catch(() => setC(null));
    }, 300);
    return () => clearTimeout(t);
  }, [imagens]);
  if (!c || imagens === 0) return null;
  if (c.estimativaUSD == null) {
    return <span className="text-xs text-stone-500">Custo: estimativa aparece depois das primeiras imagens geradas.</span>;
  }
  return (
    <span className="text-xs text-stone-500">
      Custo estimado: <strong className="text-stone-700">{formatarCusto(c.estimativaUSD, c.cotacao)}</strong>
      {c.base === "historico" ? " (média das últimas imagens)" : " (valor fixo por imagem)"}
    </span>
  );
}
