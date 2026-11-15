import { erroJson, rota } from "@/lib/http";
import { salvarUpload } from "@/lib/uploads";

export async function POST(req: Request) {
  return rota(async () => {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return erroJson("Nenhuma foto recebida.");
    return Response.json(await salvarUpload(file));
  });
}
