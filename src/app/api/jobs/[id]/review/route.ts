import { revisarImagem } from "@/lib/batches";
import { rota } from "@/lib/http";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return rota(async () => {
    const { id } = await ctx.params;
    const body = await req.json();
    const r = body.revisao === "aprovada" || body.revisao === "reprovada" ? body.revisao : null;
    revisarImagem(id, r);
    return Response.json({ ok: true });
  });
}
