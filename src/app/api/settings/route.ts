import { rota } from "@/lib/http";
import { getSettings, saveSettings, toPublic } from "@/lib/settings";

export async function GET() {
  return rota(() => Response.json(toPublic(getSettings())));
}

export async function PUT(req: Request) {
  return rota(async () => {
    const body = await req.json();
    return Response.json(toPublic(saveSettings(body)));
  });
}
