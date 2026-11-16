"use client";

import { useEffect, useState } from "react";
import { FUNDOS, LIMITES, MODELOS_SUGERIDOS, POSES, PROPORCOES, QUALIDADES, SYSTEM_PROMPT_PADRAO } from "@/lib/catalog";
import { api, enviarJson, formatarCusto, mensagemErro, type ResumoCustos } from "@/lib/client";
import type { PublicSettings } from "@/lib/settings";

type Form = Omit<PublicSettings, "hasApiKey" | "apiKeyMasked" | "apiKeyFromEnv"> & { apiKey: string };

export default function ConfiguracoesPage() {
  const [atual, setAtual] = useState<PublicSettings | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [testando, setTestando] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pastas, setPastas] = useState<{ pastaArquivos: string; pastaEntrada: string; pastaSaida: string } | null>(null);
  const [custos, setCustos] = useState<ResumoCustos | null>(null);

  useEffect(() => {
    api<{ pastaArquivos: string; pastaEntrada: string; pastaSaida: string }>("/api/pastas/resumo")
      .then(setPastas)
      .catch(() => {});
    api<ResumoCustos>("/api/custos")
      .then(setCustos)
      .catch(() => {});
  }, []);

  function aplicar(s: PublicSettings) {
    setAtual(s);
    const { hasApiKey: _h, apiKeyMasked: _m, apiKeyFromEnv: _e, ...resto } = s;
    setForm({ ...resto, apiKey: "" });
  }

  useEffect(() => {
    api<PublicSettings>("/api/settings")
      .then(aplicar)
      .catch((e) => setAviso({ ok: false, texto: mensagemErro(e) }));
  }, []);

  function campo<K extends keyof Form>(k: K, v: Form[K]) {
    setForm((f) => (f ? { ...f, [k]: v } : f));
  }

  async function salvar(): Promise<boolean> {
    if (!form) return false;
    setSalvando(true);
    setAviso(null);
    try {
      aplicar(await api<PublicSettings>("/api/settings", enviarJson("PUT", form)));
      setAviso({ ok: true, texto: "Configurações salvas." });
      return true;
    } catch (e) {
      setAviso({ ok: false, texto: mensagemErro(e) });
      return false;
    } finally {
      setSalvando(false);
    }
  }

  async function testar() {
    if (!(await salvar())) return;
    setTestando(true);
    try {
      const r = await api<{ ok: boolean; message: string }>("/api/settings/test", { method: "POST" });
      setAviso({ ok: r.ok, texto: r.message });
    } catch (e) {
      setAviso({ ok: false, texto: mensagemErro(e) });
    } finally {
      setTestando(false);
    }
  }

  async function apagarChave() {
    if (!confirm("Apagar a chave da API salva?")) return;
    aplicar(await api<PublicSettings>("/api/settings", enviarJson("PUT", { clearApiKey: true })));
    setAviso({ ok: true, texto: "Chave apagada." });
  }

  if (!form || !atual) return <p className="ajuda">{aviso?.texto ?? "Carregando…"}</p>;

  const simulacao = form.provider === "simulacao";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="titulo">Configurações</h1>
        <p className="ajuda mt-1">Conexão com a IA e padrões usados em cada nova geração.</p>
      </div>

      <section className="card space-y-4">
        <h2 className="subtitulo">Conexão com a IA</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="rotulo" htmlFor="provider">
              Provedor
            </label>
            <select
              id="provider"
              className="campo"
              value={form.provider}
              onChange={(e) => campo("provider", e.target.value as Form["provider"])}
            >
              <option value="openai">OpenAI GPT Image (ou API compatível)</option>
              <option value="simulacao">Simulação (testar sem custo)</option>
            </select>
          </div>
          <div>
            <label className="rotulo" htmlFor="model">
              Modelo
            </label>
            <input
              id="model"
              className="campo"
              list="modelos-sugeridos"
              value={form.model}
              disabled={simulacao}
              onChange={(e) => campo("model", e.target.value)}
            />
            <datalist id="modelos-sugeridos">
              {MODELOS_SUGERIDOS.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            <p className="ajuda mt-1">“sunburst” = mais fiel na edição · “flare” = mais rápido.</p>
          </div>
          <div className="sm:col-span-2">
            <label className="rotulo" htmlFor="baseUrl">
              URL da API
            </label>
            <input
              id="baseUrl"
              className="campo"
              value={form.baseUrl}
              disabled={simulacao}
              onChange={(e) => campo("baseUrl", e.target.value)}
              placeholder="https://api.openai.com/v1"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="rotulo" htmlFor="apiKey">
              Chave da API
            </label>
            <div className="flex gap-2">
              <input
                id="apiKey"
                type="password"
                className="campo"
                value={form.apiKey}
                disabled={simulacao}
                autoComplete="off"
                onChange={(e) => campo("apiKey", e.target.value)}
                placeholder={atual.hasApiKey ? `Salva: ${atual.apiKeyMasked} (deixe vazio para manter)` : "Cole a chave aqui (ex.: sk-...)"}
              />
              {atual.hasApiKey && !atual.apiKeyFromEnv && (
                <button type="button" className="btn-secundario shrink-0" onClick={apagarChave}>
                  Apagar
                </button>
              )}
            </div>
            <p className="ajuda mt-1">
              {atual.apiKeyFromEnv
                ? "Usando a chave definida na variável OPENAI_API_KEY do servidor."
                : "A chave fica guardada só no servidor e nunca volta inteira para o navegador."}{" "}
              Na OpenAI, os modelos GPT Image exigem a organização verificada.
            </p>
          </div>
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="subtitulo">Pastas e automação</h2>
        {pastas && (
          <div className="space-y-1 text-sm text-stone-600">
            <p>
              Pasta de arquivos no servidor: <code className="rounded bg-stone-100 px-1.5 py-0.5 text-xs">{pastas.pastaArquivos}</code>
            </p>
            <p>
              Entrada: <strong>{pastas.pastaEntrada}</strong> · Saída: <strong>{pastas.pastaSaida}</strong> (mesma estrutura de
              pastas). No CasaOS, essa pasta é a que você mapeou no YAML (ex.: /DATA/AppData/estudio-ia/arquivos).
            </p>
          </div>
        )}
        <label className="flex items-start gap-3 rounded-xl border border-stone-200 p-3">
          <input
            type="checkbox"
            className="mt-0.5 h-5 w-5 accent-rose-600"
            checked={form.autoMode}
            onChange={(e) => campo("autoMode", e.target.checked)}
          />
          <span>
            <span className="block text-sm font-semibold text-stone-900">Modo automático</span>
            <span className="block text-sm text-stone-500">
              Produto novo (ou com fotos novas) nas pastas entra sozinho na fila, com as poses, o fundo e a modelo padrão. Sem
              precisar clicar em nada. As fotos precisam ficar 20 segundos sem mudar antes de entrar.
            </span>
          </span>
        </label>
      </section>

      <section className="card space-y-4">
        <h2 className="subtitulo">Custos</h2>
        {custos && (
          <p className="text-sm text-stone-600">
            Gasto neste mês: <strong className="text-stone-900">{formatarCusto(custos.mesUSD, custos.cotacao)}</strong> em{" "}
            {custos.imagensNoMes} {custos.imagensNoMes === 1 ? "imagem" : "imagens"} com custo calculado.
            {custos.porImagemUSD != null && <> Média por imagem: {formatarCusto(custos.porImagemUSD, custos.cotacao)}.</>}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="rotulo" htmlFor="precoEntrada">
              US$ por 1M tokens de entrada
            </label>
            <input
              id="precoEntrada"
              type="number"
              step="0.01"
              min="0"
              className="campo"
              value={form.precoEntradaMilhao}
              onChange={(e) => campo("precoEntradaMilhao", Number(e.target.value))}
            />
          </div>
          <div>
            <label className="rotulo" htmlFor="precoSaida">
              US$ por 1M tokens de saída
            </label>
            <input
              id="precoSaida"
              type="number"
              step="0.01"
              min="0"
              className="campo"
              value={form.precoSaidaMilhao}
              onChange={(e) => campo("precoSaidaMilhao", Number(e.target.value))}
            />
          </div>
          <div>
            <label className="rotulo" htmlFor="custoFixo">
              Ou valor fixo por imagem (US$)
            </label>
            <input
              id="custoFixo"
              type="number"
              step="0.001"
              min="0"
              className="campo"
              value={form.custoFixoUSD}
              onChange={(e) => campo("custoFixoUSD", Number(e.target.value))}
            />
          </div>
          <div>
            <label className="rotulo" htmlFor="cotacao">
              Cotação do dólar (R$)
            </label>
            <input
              id="cotacao"
              type="number"
              step="0.01"
              min="0"
              className="campo"
              value={form.cotacaoDolar}
              onChange={(e) => campo("cotacaoDolar", Number(e.target.value))}
            />
          </div>
        </div>
        <p className="ajuda">
          O custo é calculado pelos tokens que a API informa em cada imagem (padrão: preços do GPT Image 2.5/2.6). Se a sua API
          não informa tokens ou cobra por imagem, preencha o valor fixo (0 = usar os tokens).
        </p>
      </section>

      <section className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="subtitulo">Diretrizes da loja (system prompt)</h2>
          <button
            type="button"
            className="text-sm font-medium text-rose-700 hover:underline"
            onClick={() => {
              if (!form.systemPrompt || confirm("Substituir o texto atual pelo padrão?")) campo("systemPrompt", SYSTEM_PROMPT_PADRAO);
            }}
          >
            Restaurar padrão
          </button>
        </div>
        <p className="ajuda">
          Este texto vai junto em <strong>toda</strong> geração, antes do prompt automático (pose, fundo, produto) e da
          descrição do lote. Use para regras fixas: enquadramento, o que trocar no look, tipo de calçado, estilo das fotos.
        </p>
        <textarea
          className="campo min-h-72 font-mono text-[13px] leading-relaxed"
          value={form.systemPrompt}
          onChange={(e) => campo("systemPrompt", e.target.value)}
          maxLength={6000}
        />
        <p className="ajuda text-right">{form.systemPrompt.length}/6000</p>
      </section>

      <section className="card space-y-4">
        <h2 className="subtitulo">Padrões das imagens</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="rotulo" htmlFor="quality">
              Qualidade
            </label>
            <select id="quality" className="campo" value={form.quality} onChange={(e) => campo("quality", e.target.value)}>
              {QUALIDADES.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="rotulo" htmlFor="aspect">
              Proporção
            </label>
            <select id="aspect" className="campo" value={form.aspect} onChange={(e) => campo("aspect", e.target.value)}>
              {PROPORCOES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="rotulo" htmlFor="defaultBackground">
              Fundo padrão
            </label>
            <select
              id="defaultBackground"
              className="campo"
              value={form.defaultBackground}
              onChange={(e) => campo("defaultBackground", e.target.value)}
            >
              {FUNDOS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="rotulo" htmlFor="variations">
              Variações por pose
            </label>
            <select
              id="variations"
              className="campo"
              value={form.variations}
              onChange={(e) => campo("variations", Number(e.target.value))}
            >
              {Array.from({ length: LIMITES.variacoesMax }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="rotulo" htmlFor="concurrency">
              Imagens geradas ao mesmo tempo
            </label>
            <select
              id="concurrency"
              className="campo"
              value={form.concurrency}
              onChange={(e) => campo("concurrency", Number(e.target.value))}
            >
              {Array.from({ length: LIMITES.simultaneasMax }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <span className="rotulo">Poses padrão ({form.defaultPoses.length})</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {POSES.map((p) => {
              const marcada = form.defaultPoses.includes(p.id);
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
                    onChange={() =>
                      campo(
                        "defaultPoses",
                        marcada ? form.defaultPoses.filter((x) => x !== p.id) : [...form.defaultPoses, p.id],
                      )
                    }
                  />
                  {p.nome}
                </label>
              );
            })}
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primario" onClick={salvar} disabled={salvando || testando}>
          {salvando && !testando ? "Salvando…" : "Salvar"}
        </button>
        <button className="btn-secundario" onClick={testar} disabled={salvando || testando}>
          {testando ? "Testando…" : "Salvar e testar conexão"}
        </button>
        {aviso && <p className={`text-sm ${aviso.ok ? "text-emerald-700" : "text-red-600"}`}>{aviso.texto}</p>}
      </div>
    </div>
  );
}
