import type { Settings } from "../settings";
import { ProviderError, type EdicaoInput, type GeracaoInput, type ImageProvider, type ResultadoImagem } from "./types";

const TIMEOUT_MS = 10 * 60 * 1000;

type OpenAIError = { error?: { message?: string; code?: string; type?: string } };
type OpenAIImages = { data?: { b64_json?: string; url?: string }[]; usage?: unknown };

function traduzirErro(status: number, body: OpenAIError | null, texto: string): ProviderError {
  const msg = body?.error?.message || texto.slice(0, 400) || "sem detalhes";
  const code = body?.error?.code || body?.error?.type || "";

  if (status === 401) return new ProviderError(`Chave da API inválida (401). Confira a chave em Configurações. Detalhe: ${msg}`, status);
  if (status === 403)
    return new ProviderError(
      `Acesso negado (403). Na OpenAI, os modelos GPT Image exigem a organização verificada (platform.openai.com › Settings › Organization). Detalhe: ${msg}`,
      status,
    );
  if (status === 404) return new ProviderError(`Endereço ou modelo não encontrado (404). Confira a URL da API e o nome do modelo. Detalhe: ${msg}`, status);
  if (status === 429) {
    if (/insufficient_quota|billing|quota/i.test(code + " " + msg)) {
      return new ProviderError(`Sem créditos na conta da API (429). Adicione saldo no painel do provedor. Detalhe: ${msg}`, status);
    }
    return new ProviderError(`Limite de uso da API atingido (429); o sistema vai tentar de novo. Detalhe: ${msg}`, status, true);
  }
  if (status === 400 && /moderation|safety|content_policy|policy/i.test(code + " " + msg)) {
    return new ProviderError(`A IA recusou esta imagem pelas regras de segurança do provedor. Detalhe: ${msg}`, status);
  }
  if (status >= 500) return new ProviderError(`Erro no servidor da API (${status}); o sistema vai tentar de novo. Detalhe: ${msg}`, status, true);
  return new ProviderError(`A API recusou o pedido (${status}). Detalhe: ${msg}`, status);
}

/** Modelos GPT Image 2.5 ou mais novos aceitam tamanho personalizado (múltiplos de 16). */
export function aceitaTamanhoPersonalizado(model: string): boolean {
  const m = /gpt-image-(\d+)(?:\.(\d+))?/i.exec(model);
  if (!m) return false;
  const major = Number(m[1]);
  const minor = Number(m[2] ?? 0);
  return major > 2 || (major === 2 && minor >= 5);
}

export function tamanhoParaApi(model: string, largura: number, altura: number): string {
  if (aceitaTamanhoPersonalizado(model)) return `${largura}x${altura}`;
  if (largura === altura) return "1024x1024";
  return largura > altura ? "1536x1024" : "1024x1536";
}

export function openAIProvider(s: Settings): ImageProvider {
  const base = s.baseUrl.replace(/\/+$/, "");
  const ehGptImage = /gpt-image/i.test(s.model);

  async function chamar(path: string, init: RequestInit): Promise<unknown> {
    if (!s.apiKey) throw new ProviderError("Chave da API não configurada. Vá em Configurações e cole a sua chave.");
    let res: Response;
    try {
      res = await fetch(base + path, {
        ...init,
        headers: { Authorization: `Bearer ${s.apiKey}`, ...(init.headers ?? {}) },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      const motivo = err instanceof Error ? err.message : String(err);
      throw new ProviderError(`Não consegui falar com a API em ${base} (${motivo}). Tentando de novo em instantes.`, undefined, true);
    }
    const texto = await res.text();
    let json: unknown = null;
    try {
      json = JSON.parse(texto);
    } catch {
      /* resposta não-JSON */
    }
    if (!res.ok) throw traduzirErro(res.status, json as OpenAIError | null, texto);
    return json;
  }

  async function extrairImagem(json: unknown): Promise<ResultadoImagem> {
    const body = json as OpenAIImages;
    const item = body?.data?.[0];
    if (item?.b64_json) return { image: Buffer.from(item.b64_json, "base64"), usage: body.usage };
    if (item?.url) {
      const r = await fetch(item.url, { signal: AbortSignal.timeout(120_000) });
      if (!r.ok) throw new ProviderError(`A API gerou a imagem, mas não consegui baixá-la (${r.status}).`, r.status, true);
      return { image: Buffer.from(await r.arrayBuffer()), usage: body.usage };
    }
    throw new ProviderError("A API respondeu sem imagem. Tente de novo ou troque o modelo.", undefined, true);
  }

  return {
    id: "openai",

    async testConnection() {
      const json = (await chamar("/models", { method: "GET" })) as { data?: { id: string }[] };
      const ids = (json?.data ?? []).map((m) => m.id);
      if (ids.includes(s.model)) return `Conexão OK! O modelo "${s.model}" está disponível na sua conta.`;
      const deImagem = ids.filter((id) => /image/i.test(id));
      return `Conexão OK, mas o modelo "${s.model}" não apareceu na lista da sua conta. Modelos de imagem encontrados: ${deImagem.join(", ") || "nenhum"}.`;
    },

    async edit(input: EdicaoInput) {
      const form = new FormData();
      form.append("model", s.model);
      form.append("prompt", input.prompt);
      form.append("size", input.size);
      form.append("quality", input.quality);
      form.append("n", "1");
      if (ehGptImage) form.append("output_format", "jpeg");
      for (const img of input.images) {
        form.append("image[]", new Blob([new Uint8Array(img.data)], { type: "image/jpeg" }), img.filename);
      }
      return extrairImagem(await chamar("/images/edits", { method: "POST", body: form }));
    },

    async generate(input: GeracaoInput) {
      const body: Record<string, unknown> = {
        model: s.model,
        prompt: input.prompt,
        size: input.size,
        quality: input.quality,
        n: 1,
      };
      if (ehGptImage) body.output_format = "jpeg";
      return extrairImagem(
        await chamar("/images/generations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
    },
  };
}
