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

/** Ajusta a imagem gerada ao tamanho final exato (recorte central) e salva em JPEG. */
export async function finalizarSaida(buf: Buffer, largura: number, altura: number): Promise<Buffer> {
  return sharp(buf).resize(largura, altura, { fit: "cover", position: "centre" }).jpeg({ quality: 92 }).toBuffer();
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
