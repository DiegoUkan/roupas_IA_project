import { rota } from "@/lib/http";
import { resumo } from "@/lib/pastas";

export async function GET() {
  return rota(() => Response.json(resumo()));
}
