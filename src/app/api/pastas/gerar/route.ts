import { rota } from "@/lib/http";
import { gerarDePastas, type ProdutoParaGerar } from "@/lib/pastas";

export async function POST(req: Request) {
  return rota(async () => {
    const body = await req.json();
    const produtos: ProdutoParaGerar[] = (Array.isArray(body.produtos) ? body.produtos : []).map(
      (p: Record<string, unknown>) => ({
        caminho: String(p.caminho ?? ""),
        produto: typeof p.produto === "string" ? p.produto : undefined,
        instrucoes: typeof p.instrucoes === "string" ? p.instrucoes : undefined,
        poses: Array.isArray(p.poses) && p.poses.length ? (p.poses as string[]) : undefined,
        backgroundId: typeof p.backgroundId === "string" && p.backgroundId ? p.backgroundId : undefined,
        brandModelId: p.brandModelId === null ? null : typeof p.brandModelId === "string" && p.brandModelId ? p.brandModelId : undefined,
      }),
    );
    const pd = body.padrao ?? {};
    const id = await gerarDePastas(produtos, {
      poses: Array.isArray(pd.poses) ? pd.poses : [],
      backgroundId: String(pd.backgroundId ?? ""),
      brandModelId: pd.brandModelId ? String(pd.brandModelId) : null,
      variations: Number(pd.variations ?? 1),
      description: String(pd.description ?? ""),
    });
    return Response.json({ id });
  });
}
