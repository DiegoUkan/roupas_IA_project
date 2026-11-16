import { rota } from "@/lib/http";
import { listarPastas, resumo } from "@/lib/pastas";

export async function GET(req: Request) {
  return rota(() => {
    const todas = new URL(req.url).searchParams.get("todas") === "1";
    return Response.json({ pastas: listarPastas(todas), resumo: resumo() });
  });
}
