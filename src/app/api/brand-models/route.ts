import { createBrandModel, listBrandModels, toPublicModel } from "@/lib/brandModels";
import { rota } from "@/lib/http";

export async function GET() {
  return rota(() => Response.json(listBrandModels().map(toPublicModel)));
}

export async function POST(req: Request) {
  return rota(async () => {
    const form = await req.formData();
    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    const images = await Promise.all(files.map(async (f) => Buffer.from(await f.arrayBuffer())));
    const modelo = await createBrandModel({
      name: String(form.get("name") ?? ""),
      description: String(form.get("description") ?? ""),
      swapHair: form.get("swapHair") !== "false",
      images,
    });
    return Response.json(toPublicModel(modelo));
  });
}
