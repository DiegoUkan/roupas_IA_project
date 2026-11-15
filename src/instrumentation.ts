// Roda uma vez quando o servidor sobe: retoma a fila de geração.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { iniciarFila } = await import("./lib/queue");
    iniciarFila();
  }
}
