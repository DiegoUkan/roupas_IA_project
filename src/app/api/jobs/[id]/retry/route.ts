import { refazerImagem } from "@/lib/batches";
import { rota } from "@/lib/http";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return rota(async () => {
    const { id } = await ctx.params;
    refazerImagem(id);
    return Response.json({ ok: true });
  });
}
