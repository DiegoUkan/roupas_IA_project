import { rota } from "@/lib/http";
import { getProvider } from "@/lib/providers";
import { getSettings } from "@/lib/settings";

export async function POST() {
  return rota(async () => {
    try {
      const message = await getProvider(getSettings()).testConnection();
      return Response.json({ ok: true, message });
    } catch (err) {
      return Response.json({ ok: false, message: err instanceof Error ? err.message : String(err) });
    }
  });
}
