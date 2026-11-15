import fs from "node:fs";
import path from "node:path";
import { erroJson, rota } from "@/lib/http";
import { resolveDataPath } from "@/lib/paths";

const TIPOS: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

/** Serve fotos e imagens geradas da pasta de dados (somente leitura, sem sair da pasta). */
export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return rota(async () => {
    const rel = (await ctx.params).path.join("/");
    const full = resolveDataPath(rel);
    const tipo = TIPOS[path.extname(rel).toLowerCase()];
    if (!full || !tipo || !fs.existsSync(full) || !fs.statSync(full).isFile()) {
      return erroJson("Arquivo não encontrado.", 404);
    }

    const headers: Record<string, string> = {
      "Content-Type": tipo,
      "Cache-Control": "private, max-age=31536000, immutable",
    };
    if (new URL(req.url).searchParams.has("baixar")) {
      const nome = path.basename(full).replace(/-[0-9a-f]{6}(?=\.jpg$)/, "");
      headers["Content-Disposition"] = `attachment; filename="${nome}"`;
    }
    return new Response(new Uint8Array(fs.readFileSync(full)), { headers });
  });
}
