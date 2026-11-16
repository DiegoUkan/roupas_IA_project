import sharp from "sharp";

export class ImagemInvalidaError extends Error {}

/** Corrige rotação (EXIF), limita a 2048px e converte para JPEG. */
export async function normalizarUpload(buf: Buffer): Promise<{ data: Buffer; width: number; height: number }> {
  try {
    const { data, info } = await sharp(buf, { failOn: "none" })
      .rotate()
      .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height };
  } catch {
    throw new ImagemInvalidaError(
      "Não consegui ler esta imagem. Envie JPG, PNG ou WEBP. (Fotos HEIC do iPhone: envie pelo navegador do celular, que converte sozinho, ou ative Ajustes › Câmera › Formatos › Mais Compatível.)",
    );
  }
}

/**
 * Ajusta a imagem gerada ao tamanho final SEM cortar nada (cabeça e pés ficam inteiros).
 * Se a proporção vier diferente da pedida, a imagem inteira é centralizada e o espaço
 * que sobra é preenchido com uma versão desfocada do próprio fundo.
 */
export async function finalizarSaida(
  buf: Buffer,
  largura: number,
  altura: number,
): Promise<{ data: Buffer; original: string }> {
  const meta = await sharp(buf).metadata();
  const w0 = meta.width ?? largura;
  const h0 = meta.height ?? altura;
  const original = `${w0}x${h0}`;

  if (Math.abs(w0 / h0 - largura / altura) < 0.01) {
    return { data: await sharp(buf).resize(largura, altura, { fit: "fill" }).jpeg({ quality: 92 }).toBuffer(), original };
  }

  const fundo = await sharp(buf).resize(largura, altura, { fit: "cover" }).blur(40).modulate({ brightness: 1.02 }).toBuffer();
  const frente = await sharp(buf).resize(largura, altura, { fit: "inside" }).toBuffer();
  const data = await sharp(fundo).composite([{ input: frente, gravity: "centre" }]).jpeg({ quality: 92 }).toBuffer();
  return { data, original };
}

/** Imagem de simulação: a foto original com uma faixa de texto (para testar sem gastar). */
export async function imagemSimulada(base: Buffer | null, largura: number, altura: number, texto: string): Promise<Buffer> {
  const seguro = texto.replace(/[<>&"']/g, " ");
  const svg = Buffer.from(
    `<svg width="${largura}" height="${altura}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="${altura - 170}" width="${largura}" height="170" fill="rgba(0,0,0,0.55)"/>
      <text x="50%" y="${altura - 105}" font-family="Arial, sans-serif" font-size="46" font-weight="bold" fill="#ffffff" text-anchor="middle">SIMULAÇÃO</text>
      <text x="50%" y="${altura - 50}" font-family="Arial, sans-serif" font-size="34" fill="#ffffff" text-anchor="middle">${seguro}</text>
    </svg>`,
  );
  const fundo = base
    ? sharp(base).resize(largura, altura, { fit: "cover" }).modulate({ brightness: 1.05, saturation: 1.1 })
    : sharp({ create: { width: largura, height: altura, channels: 3, background: "#e9d5d0" } });
  return fundo.composite([{ input: svg }]).jpeg({ quality: 90 }).toBuffer();
}
