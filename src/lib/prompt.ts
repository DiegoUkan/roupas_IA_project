import type { Fundo, Pose } from "./catalog";

export type ModeloMarcaPrompt = {
  descricao: string;
  trocarCabelo: boolean;
  qtdReferencias: number;
};

function intervalo(inicio: number, fim: number): string {
  return inicio === fim ? `Image ${inicio}` : `Images ${inicio}-${fim}`;
}

/** Monta o prompt de edição: preserva a roupa, troca rosto (opcional), aplica pose e fundo. */
export function montarPromptEdicao(opts: {
  pose: Pose;
  fundo: Fundo;
  qtdFotosPeca: number;
  modelo?: ModeloMarcaPrompt | null;
  descricao?: string;
}): string {
  const { pose, fundo, qtdFotosPeca, modelo, descricao } = opts;
  const linhas: string[] = [];

  linhas.push("Create a professional e-commerce fashion photo for an online clothing store.");
  linhas.push("");
  linhas.push("INPUT IMAGES:");
  linhas.push(`- ${intervalo(1, qtdFotosPeca)}: photo(s) of a person wearing the garment that is being sold.`);
  if (modelo && modelo.qtdReferencias > 0) {
    linhas.push(
      `- ${intervalo(qtdFotosPeca + 1, qtdFotosPeca + modelo.qtdReferencias)}: reference photo(s) of the brand model (face${modelo.trocarCabelo ? " and hair" : ""}).`,
    );
  }

  linhas.push("");
  linhas.push("GARMENT (HIGHEST PRIORITY):");
  linhas.push(
    "Reproduce the clothing from the garment photo(s) exactly: same colors, fabric, texture, print or pattern, cut, fit, length, neckline, sleeves, buttons, zippers, seams and every small detail. Do not add, remove or redesign any clothing element and do not change its color.",
  );

  linhas.push("");
  linhas.push("PERSON:");
  if (modelo && modelo.qtdReferencias > 0) {
    linhas.push(
      modelo.trocarCabelo
        ? "Replace the person's face and hair with the brand model from the reference photo(s): same facial features, skin tone, hairstyle and hair color."
        : "Replace the person's face with the brand model's face from the reference photo(s): same facial features and skin tone. Keep the original hair.",
    );
    if (modelo.descricao.trim()) linhas.push(`Brand model notes: ${modelo.descricao.trim()}`);
  } else {
    linhas.push("Keep the same person from the photo. Do not change their identity; only improve the image quality.");
  }
  linhas.push("Realistic body with natural proportions, natural friendly expression, natural skin texture (no plastic look).");

  linhas.push("");
  linhas.push(`POSE: ${pose.prompt}.`);
  linhas.push(`BACKGROUND: ${fundo.prompt}.`);
  linhas.push("");
  linhas.push(
    "PHOTO STYLE: high-end catalog photography, soft diffused lighting, accurate true-to-life colors, sharp focus, high resolution. No text, no watermark, no logos added.",
  );
  if (pose.corpoInteiro) {
    linhas.push("Framing: the whole body is visible, with a comfortable margin above the head and below the feet.");
  }

  if (descricao && descricao.trim()) {
    linhas.push("");
    linhas.push(`EXTRA NOTES FROM THE STORE OWNER (may be in Portuguese): ${descricao.trim()}`);
  }

  return linhas.join("\n");
}

/** Prompt para criar uma modelo fictícia da marca (retrato de referência). */
export function montarPromptModeloFicticia(descricao: string): string {
  return [
    "Photorealistic studio portrait of a fictional fashion model, created for a clothing brand's catalog.",
    descricao.trim() ? `Appearance (may be in Portuguese): ${descricao.trim()}.` : "Appearance: friendly, natural look.",
    "Front-facing head and shoulders, neutral friendly expression, looking at the camera, plain light gray background, soft even studio lighting, natural skin texture, sharp focus.",
    "This must be a new, non-existent person (not a celebrity or any real person). No text, no watermark.",
  ].join("\n");
}
