import { createBrandModel, toPublicModel } from "@/lib/brandModels";
import { rota } from "@/lib/http";
import { montarPromptModeloFicticia } from "@/lib/prompt";
import { getProvider, tamanhoParaApi } from "@/lib/providers";
import { getSettings } from "@/lib/settings";

/** Cria uma modelo fictícia (pessoa que não existe) para usar como rosto da marca. */
export async function POST(req: Request) {
  return rota(async () => {
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    const description = String(body.description ?? "");
    if (!name) throw new Error("Dê um nome para a modelo.");

    const settings = getSettings();
    const size = settings.provider === "simulacao" ? "1024x1024" : tamanhoParaApi(settings.model, 1024, 1024);
    const { image } = await getProvider(settings).generate({
      prompt: montarPromptModeloFicticia(description),
      size,
      quality: settings.quality,
      label: name,
    });
    const modelo = await createBrandModel({ name, description, swapHair: body.swapHair !== false, images: [image] });
    return Response.json(toPublicModel(modelo));
  });
}
