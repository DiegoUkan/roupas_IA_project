import { rota } from "@/lib/http";
import { ignorarPasta } from "@/lib/pastas";

export async function POST(req: Request) {
  return rota(async () => {
    const body = await req.json();
    ignorarPasta(String(body.caminho ?? ""), body.ignorar !== false);
    return Response.json({ ok: true });
  });
}
