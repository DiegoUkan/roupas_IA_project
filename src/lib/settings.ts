import { db } from "./db";
import { DEFAULT_FUNDO, DEFAULT_POSES, FUNDOS, LIMITES, POSES, PROPORCOES, QUALIDADES } from "./catalog";

export type ProviderId = "openai" | "simulacao";

export type Settings = {
  provider: ProviderId;
  baseUrl: string;
  apiKey: string;
  model: string;
  quality: string;
  aspect: string;
  defaultPoses: string[];
  defaultBackground: string;
  variations: number;
  concurrency: number;
};

/** O que o navegador recebe: nunca a chave inteira. */
export type PublicSettings = Omit<Settings, "apiKey"> & {
  hasApiKey: boolean;
  apiKeyMasked: string;
  apiKeyFromEnv: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  provider: "openai",
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-image-2.6-sunburst",
  quality: "high",
  aspect: "3:4",
  defaultPoses: DEFAULT_POSES,
  defaultBackground: DEFAULT_FUNDO,
  variations: 1,
  concurrency: 2,
};

const KEY = "app";

function readStored(): Partial<Settings> {
  const row = db().prepare("SELECT value FROM settings WHERE key = ?").get(KEY) as { value: string } | undefined;
  if (!row) return {};
  try {
    return JSON.parse(row.value) as Partial<Settings>;
  } catch {
    return {};
  }
}

export function getSettings(): Settings {
  const s = { ...DEFAULT_SETTINGS, ...readStored() };
  // Permite definir a chave por variável de ambiente (útil no Docker) quando não há chave salva.
  if (!s.apiKey && process.env.OPENAI_API_KEY) s.apiKey = process.env.OPENAI_API_KEY;
  return s;
}

function mask(key: string): string {
  if (!key) return "";
  if (key.length <= 8) return "••••";
  return `${key.slice(0, 3)}••••${key.slice(-4)}`;
}

export function toPublic(s: Settings): PublicSettings {
  const { apiKey, ...rest } = s;
  const stored = readStored();
  return {
    ...rest,
    hasApiKey: Boolean(apiKey),
    apiKeyMasked: mask(apiKey),
    apiKeyFromEnv: !stored.apiKey && Boolean(process.env.OPENAI_API_KEY),
  };
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * Valida e salva. `apiKey` vazio/ausente mantém a chave atual; use `clearApiKey: true` para apagar.
 */
export function saveSettings(input: Partial<Settings> & { clearApiKey?: boolean }): Settings {
  const current = { ...DEFAULT_SETTINGS, ...readStored() };
  const next: Settings = { ...current };

  if (input.provider === "openai" || input.provider === "simulacao") next.provider = input.provider;

  if (typeof input.baseUrl === "string") {
    const url = input.baseUrl.trim().replace(/\/+$/, "");
    if (url && !/^https?:\/\//i.test(url)) throw new Error("A URL da API precisa começar com http:// ou https://");
    next.baseUrl = url || DEFAULT_SETTINGS.baseUrl;
  }

  if (input.clearApiKey) next.apiKey = "";
  else if (typeof input.apiKey === "string" && input.apiKey.trim()) next.apiKey = input.apiKey.trim();

  if (typeof input.model === "string" && input.model.trim()) next.model = input.model.trim();
  if (typeof input.quality === "string" && QUALIDADES.some((q) => q.id === input.quality)) next.quality = input.quality;
  if (typeof input.aspect === "string" && PROPORCOES.some((p) => p.id === input.aspect)) next.aspect = input.aspect;

  if (Array.isArray(input.defaultPoses)) {
    const valid = input.defaultPoses.filter((id) => POSES.some((p) => p.id === id));
    if (valid.length === 0) throw new Error("Escolha pelo menos uma pose padrão.");
    next.defaultPoses = valid;
  }

  if (typeof input.defaultBackground === "string" && FUNDOS.some((f) => f.id === input.defaultBackground)) {
    next.defaultBackground = input.defaultBackground;
  }

  if (input.variations !== undefined) next.variations = clampInt(input.variations, 1, LIMITES.variacoesMax, next.variations);
  if (input.concurrency !== undefined) next.concurrency = clampInt(input.concurrency, 1, LIMITES.simultaneasMax, next.concurrency);

  db()
    .prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(KEY, JSON.stringify(next));

  return getSettings();
}
