// Roda uma vez quando o servidor sobe: retoma a fila de geração e liga a varredura das pastas.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { iniciarFila } = await import("./lib/queue");
    iniciarFila();
    const { iniciarVarredura } = await import("./lib/pastas");
    iniciarVarredura();
  }
}
