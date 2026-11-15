import { imagemSimulada } from "../images";
import type { EdicaoInput, GeracaoInput, ImageProvider } from "./types";

function dimensoes(size: string): [number, number] {
  const [w, h] = size.split("x").map(Number);
  return [w || 1024, h || 1536];
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Provedor de teste: não chama nenhuma API e não gasta nada. */
export function simulacaoProvider(): ImageProvider {
  return {
    id: "simulacao",
    async testConnection() {
      return "Modo simulação ativo: nenhuma API é chamada e nada é cobrado. As imagens recebem uma faixa escrita SIMULAÇÃO.";
    },
    async edit(input: EdicaoInput) {
      await esperar(1500 + Math.random() * 1500);
      const [w, h] = dimensoes(input.size);
      return { image: await imagemSimulada(input.images[0]?.data ?? null, w, h, input.label ?? "") };
    },
    async generate(input: GeracaoInput) {
      await esperar(1200);
      const [w, h] = dimensoes(input.size);
      return { image: await imagemSimulada(null, w, h, input.label ?? "modelo fictícia") };
    },
  };
}
