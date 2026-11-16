// Inicia o servidor de produção fora do Docker.
// Os dados ficam em ./data (ou na pasta definida em DATA_DIR).
import path from "node:path";
import { pathToFileURL } from "node:url";

const raiz = process.cwd();
process.env.DATA_DIR ||= path.join(raiz, "data");
process.env.ARQUIVOS_DIR ||= path.join(raiz, "arquivos");
process.env.PORT ||= "3000";
process.env.HOSTNAME ||= "0.0.0.0";
process.env.NODE_ENV = "production";

console.log(`Estúdio IA em http://localhost:${process.env.PORT} (dados em ${process.env.DATA_DIR}, pastas em ${process.env.ARQUIVOS_DIR})`);
await import(pathToFileURL(path.join(raiz, ".next", "standalone", "server.js")).href);
