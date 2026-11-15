import { criarLote, listarLotes } from "@/lib/batches";
import { rota } from "@/lib/http";

export async function GET() {
  return rota(() => Response.json(listarLotes()));
}

export async function POST(req: Request) {
  return rota(async () => {
    const body = await req.json();
    const id = criarLote({
      groups: Array.isArray(body.groups) ? body.groups : [],
      poses: Array.isArray(body.poses) ? body.poses : [],
      backgroundId: String(body.backgroundId ?? ""),
      brandModelId: body.brandModelId ? String(body.brandModelId) : null,
      description: String(body.description ?? ""),
      variations: Number(body.variations ?? 1),
    });
    return Response.json({ id });
  });
}
