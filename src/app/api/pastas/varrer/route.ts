import { rota } from "@/lib/http";
import { varrer } from "@/lib/pastas";

export async function POST() {
  return rota(() => Response.json(varrer()));
}
