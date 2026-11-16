import { rota } from "@/lib/http";
import { listarCategorias } from "@/lib/pastas";

export async function GET() {
  return rota(() => Response.json(listarCategorias()));
}
