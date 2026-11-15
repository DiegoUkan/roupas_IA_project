export type ImagemEntrada = { data: Buffer; filename: string };

export type EdicaoInput = {
  /** Fotos da peça primeiro, depois as referências da modelo da marca. */
  images: ImagemEntrada[];
  prompt: string;
  /** Tamanho pedido à API, ex.: "1152x1536". */
  size: string;
  quality: string;
  /** Texto curto usado só pelo modo simulação. */
  label?: string;
};

export type GeracaoInput = Omit<EdicaoInput, "images">;

export type ResultadoImagem = { image: Buffer; usage?: unknown };

export interface ImageProvider {
  id: string;
  testConnection(): Promise<string>;
  edit(input: EdicaoInput): Promise<ResultadoImagem>;
  generate(input: GeracaoInput): Promise<ResultadoImagem>;
}

/** Erro já traduzido para português. `retryable` indica se vale tentar de novo depois. */
export class ProviderError extends Error {
  constructor(
    message: string,
    public status?: number,
    public retryable = false,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
