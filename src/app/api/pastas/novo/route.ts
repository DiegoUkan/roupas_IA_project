import { rota } from "@/lib/http";
import { criarProduto, gerarDePastas, padraoDasConfiguracoes } from "@/lib/pastas";

/** Novo produto pelo celular: cria a pasta em "Para editar" e, se pedido, já gera com os padrões. */
export async function POST(req: Request) {
  return rota(async () => {
    const form = await req.formData();
    const arquivos = form.getAll("files").filter((f): f is File => f instanceof File);
    const fotos = await Promise.all(arquivos.map(async (f) => ({ nome: f.name, data: Buffer.from(await f.arrayBuffer()) })));
    const caminho = criarProduto({
      nome: String(form.get("nome") ?? ""),
      categoria: String(form.get("categoria") ?? ""),
      instrucoes: String(form.get("instrucoes") ?? ""),
      fotos,
    });
    let loteId: string | null = null;
    if (form.get("gerarAgora") === "true") {
      loteId = await gerarDePastas([{ caminho }], padraoDasConfiguracoes());
    }
    return Response.json({ caminho, loteId });
  });
}
