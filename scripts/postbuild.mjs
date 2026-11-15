// Depois do build: copia os arquivos estáticos para dentro da pasta standalone,
// para que "npm start" (node .next/standalone/server.js) funcione fora do Docker.
import fs from "node:fs";
import path from "node:path";

const raiz = process.cwd();
const standalone = path.join(raiz, ".next", "standalone");

if (fs.existsSync(standalone)) {
  fs.cpSync(path.join(raiz, ".next", "static"), path.join(standalone, ".next", "static"), { recursive: true });
  if (fs.existsSync(path.join(raiz, "public"))) {
    fs.cpSync(path.join(raiz, "public"), path.join(standalone, "public"), { recursive: true });
  }
  console.log("Arquivos estáticos copiados para .next/standalone");
}
