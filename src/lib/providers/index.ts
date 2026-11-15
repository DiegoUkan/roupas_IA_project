import type { Settings } from "../settings";
import { openAIProvider } from "./openai";
import { simulacaoProvider } from "./simulacao";
import type { ImageProvider } from "./types";

export { ProviderError } from "./types";
export type { ImageProvider } from "./types";
export { tamanhoParaApi } from "./openai";

/** Ponto único para escolher o provedor. Novos provedores (FASHN, Gemini, OpenRouter...) entram aqui. */
export function getProvider(s: Settings): ImageProvider {
  switch (s.provider) {
    case "simulacao":
      return simulacaoProvider();
    case "openai":
    default:
      return openAIProvider(s);
  }
}
