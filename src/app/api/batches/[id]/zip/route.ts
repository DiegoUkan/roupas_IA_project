import { zipSync } from "fflate";
import { arquivosProntos } from "@/lib/batches";
import { erroJson, rota } from "@/lib/http";
import { readDataFile } from "@/lib/paths";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return rota(async () => {
    const { id } = await ctx.params;
    const arquivos = arquivosProntos(id);
    if (arquivos.length === 0) return erroJson("Ainda não há imagens prontas neste lote.", 404);

    const conteudo: Record<string, Uint8Array> = {};
    for (const a of arquivos) {
      const nome = `${a.code}/${a.code}_${a.pose_id}_${a.variation}.jpg`;
      conteudo[nome] = new Uint8Array(readDataFile(a.output_file));
    }
    // JPEG já é comprimido: guardar sem recomprimir (level 0) deixa o ZIP rápido.
    const zip = zipSync(conteudo, { level: 0 });
    return new Response(new Uint8Array(zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="lote-${id}.zip"`,
        "Content-Length": String(zip.byteLength),
      },
    });
  });
}
