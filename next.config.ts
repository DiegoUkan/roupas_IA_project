import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Gera uma pasta enxuta (.next/standalone) usada pela imagem Docker.
  output: "standalone",
  serverExternalPackages: ["sharp"],
  // Garante que a pasta de dados nunca entre no rastreamento de arquivos do build.
  outputFileTracingExcludes: { "*": ["./data/**/*", "./arquivos/**/*"] },
  // O rastreamento automático não copia as bibliotecas nativas do sharp (libvips) no Windows.
  outputFileTracingIncludes: { "*": ["./node_modules/@img/**/*"] },
};

export default nextConfig;
