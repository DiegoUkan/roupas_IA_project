import { apagarLote, detalharLote } from "@/lib/batches";
import { erroJson, rota } from "@/lib/http";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return rota(async () => {
    const { id } = await ctx.params;
    const lote = detalharLote(id);
    return lote ? Response.json(lote) : erroJson("Lote não encontrado.", 404);
  });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return rota(async () => {
    const { id } = await ctx.params;
    apagarLote(id);
    return Response.json({ ok: true });
  });
}
