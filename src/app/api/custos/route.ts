import { resumoCustos } from "@/lib/custos";
import { rota } from "@/lib/http";

export async function GET(req: Request) {
  return rota(() => {
    const n = Math.max(0, Math.round(Number(new URL(req.url).searchParams.get("imagens") ?? 0)) || 0);
    return Response.json(resumoCustos(n));
  });
}
