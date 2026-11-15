import { deleteBrandModel, toPublicModel, updateBrandModel } from "@/lib/brandModels";
import { rota } from "@/lib/http";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return rota(async () => {
    const { id } = await ctx.params;
    const body = await req.json();
    return Response.json(toPublicModel(updateBrandModel(id, body)));
  });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return rota(async () => {
    const { id } = await ctx.params;
    deleteBrandModel(id);
    return Response.json({ ok: true });
  });
}
