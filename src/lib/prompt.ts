import type { Fundo, Pose } from "./catalog";

export type ModeloMarcaPrompt = {
  descricao: string;
  trocarCabelo: boolean;
  qtdReferencias: number;
};

function intervalo(inicio: number, fim: number): string {
  return inicio === fim ? `Image ${inicio}` : `Images ${inicio}-${fim}`;
}

/**
 * Monta o prompt de edição. Ordem:
 * 1) diretrizes da loja (system prompt editável, sempre enviado);
 * 2) o que é cada imagem de entrada;
 * 3) o produto (fixo) × o resto do look (pode trocar);
 * 4) pessoa, pose, fundo, enquadramento;
 * 5) descrição opcional do lote.
 */
export function montarPromptEdicao(opts: {
  pose: Pose;
  fundo: Fundo;
  qtdFotosPeca: number;
  modelo?: ModeloMarcaPrompt | null;
  descricao?: string;
  /** O que está à venda, ex.: "camisa listrada". Vazio = a IA deduz pela foto. */
  produto?: string;
  /** System prompt / diretrizes da loja. */
  diretrizes?: string;
  /** Instruções só deste produto (prompt.txt da pasta ou digitadas na tela). */
  instrucoesProduto?: string;
}): string {
  const { pose, fundo, qtdFotosPeca, modelo, descricao, produto, diretrizes, instrucoesProduto } = opts;
  const p = (produto ?? "").trim();
  const linhas: string[] = [];

  if (diretrizes && diretrizes.trim()) {
    linhas.push("STORE GUIDELINES — ALWAYS FOLLOW (written in Portuguese by the store owner):");
    linhas.push(diretrizes.trim());
    linhas.push("");
    linhas.push("---");
    linhas.push("");
  }

  linhas.push("TASK: create a professional e-commerce fashion photo for an online clothing store.");
  linhas.push("");
  linhas.push("INPUT IMAGES:");
  linhas.push(`- ${intervalo(1, qtdFotosPeca)}: photo(s) of a person wearing the product that is being sold.`);
  if (modelo && modelo.qtdReferencias > 0) {
    linhas.push(
      `- ${intervalo(qtdFotosPeca + 1, qtdFotosPeca + modelo.qtdReferencias)}: reference photo(s) of the brand model (face${modelo.trocarCabelo ? " and hair" : ""}).`,
    );
  }

  linhas.push("");
  linhas.push("PRODUCT BEING SOLD (HIGHEST PRIORITY — MUST STAY IDENTICAL):");
  if (p) {
    linhas.push(`The product is: "${p}" (may be in Portuguese).`);
    linhas.push(
      "Reproduce this product exactly as in the photo(s): same colors, fabric, texture, print or pattern, cut, fit, length, neckline, sleeves, buttons, zippers, seams and every small detail. Do not redesign it or change its color.",
    );
    linhas.push("");
    linhas.push("REST OF THE OUTFIT (NOT the product):");
    linhas.push(
      "Everything else the person wears in the original photo — other clothes, footwear, bags, accessories — is NOT for sale. Replace those items with pieces that coordinate well with the product and make a stylish, fashionable, catalog-ready look. Do not copy them from the original photo. Never use flip-flops, slippers, socks or house shoes unless they are the product; choose elegant footwear that suits the look.",
    );
  } else {
    linhas.push(
      "The product is the clothing shown in the photo(s). Reproduce it exactly: same colors, fabric, texture, print or pattern, cut, fit, length, neckline, sleeves, buttons, zippers, seams and every small detail. Do not redesign it or change its color.",
    );
    linhas.push(
      "Casual non-product items such as flip-flops, slippers, socks or house shoes must be replaced by elegant footwear that suits the look.",
    );
  }

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
    linhas.push("Keep the same person from the photo. Do not change their identity.");
  }
  linhas.push("Realistic body with natural proportions, natural friendly expression, natural skin texture (no plastic look).");

  linhas.push("");
  linhas.push(`POSE: ${pose.prompt}.`);
  linhas.push(`BACKGROUND: ${fundo.prompt}.`);
  linhas.push("");
  if (pose.corpoInteiro) {
    linhas.push(
      "FRAMING (MANDATORY): full-body shot, the camera is far enough to show the ENTIRE person from the top of the hair to the soles of the shoes. Nothing may touch or cross the image edges: leave clear empty background above the head and below the feet (about 5% of the image height each). Do not crop the head, hair, hands or feet.",
    );
  } else {
    linhas.push("FRAMING: waist-up, with the complete head and hair inside the image and some space above the head.");
  }
  linhas.push(
    "PHOTO STYLE: high-end catalog photography, soft diffused lighting, accurate true-to-life colors, sharp focus, high resolution. No text, no watermark, no logos added.",
  );

  if (instrucoesProduto && instrucoesProduto.trim()) {
    linhas.push("");
    linhas.push("INSTRUCTIONS FOR THIS SPECIFIC PRODUCT (written in Portuguese by the store owner; follow them):");
    linhas.push(instrucoesProduto.trim());
  }

  if (descricao && descricao.trim()) {
    linhas.push("");
    linhas.push(`EXTRA NOTES FOR THIS BATCH (may be in Portuguese): ${descricao.trim()}`);
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
