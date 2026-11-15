# Estúdio IA — fotos da loja

Transforma as fotos das roupas tiradas no dia a dia em imagens padronizadas para o site:
melhora a foto, troca o rosto pela **modelo da marca**, aplica **poses** e **fundo**, e gera tudo em lote.

O planejamento completo, as decisões e o andamento estão em [PROJETO.md](PROJETO.md).

---

## Rodar no servidor Docker

1. Copie esta pasta para o servidor (sem `node_modules`, `.next` e `data`).
2. Crie o arquivo `.env` ao lado do `docker-compose.yml` (modelo em `.env.example`):

   ```
   APP_PASSWORD=uma-senha-boa
   ```

   - `APP_PASSWORD`: senha para entrar no sistema. Deixe vazio para não pedir senha (só faça isso se o servidor **não** estiver acessível pela internet).
   - `OPENAI_API_KEY` (opcional): a chave também pode ser colocada pela tela **Configurações**.

3. Suba o container:

   ```bash
   docker compose up -d --build
   ```

4. Abra `http://IP-DO-SERVIDOR:3000` no computador ou no celular.

**Atualizar** depois de mudanças no código: rode de novo `docker compose up -d --build`.
Os dados (banco, fotos, modelos e imagens geradas) ficam no volume `estudio-dados` e não se perdem.

**Backup** do volume:

```bash
docker run --rm -v estudio-dados:/dados -v "$PWD":/backup busybox tar czf /backup/estudio-backup.tgz -C /dados .
```

> Se o servidor for acessível pela internet, coloque-o atrás de um proxy com HTTPS (Nginx, Caddy, Traefik, Cloudflare Tunnel…) e use `APP_PASSWORD`.

---

## Primeiro uso

1. **Configurações** → cole a **chave da API** da OpenAI → **Salvar e testar conexão**.
   - Modelo padrão: `gpt-image-2.6-sunburst` (mais fiel na edição). `gpt-image-2.6-flare` é mais rápido.
   - Na OpenAI, os modelos GPT Image exigem a **organização verificada** (platform.openai.com › Settings › Organization).
   - Para testar sem gastar, escolha o provedor **Simulação**.
2. **Modelos** → **Gerar modelo fictícia** (recomendado) ou envie de 1 a 3 fotos de rosto de alguém que autorizou o uso da imagem.
3. **Gerar** → envie as fotos, confira as peças, poses e fundo → **Gerar imagens**.
4. Acompanhe em **Lotes**. Pode fechar a página: a geração continua no servidor. Baixe tudo em ZIP.

### Nome das fotos para lote

Tudo antes do **último `_`** é o código da peça:

```
VESTIDO-FLORAL_1.jpg  ┐
VESTIDO-FLORAL_2.jpg  ┘→ peça VESTIDO-FLORAL (2 fotos)
CALCA-JEANS_1.jpg      → peça CALCA-JEANS
```

Ou use **Escolher pasta** com uma subpasta por peça (o nome da subpasta vira o código).
Máximo de 6 fotos por peça e 300 por lote.

---

## Rodar no computador (desenvolvimento)

Requer Node.js 26.

```bash
npm install
```

```bash
npm run dev
```

Abre em `http://localhost:3000`. Se a porta 3000 estiver ocupada, defina outra antes (PowerShell: `$env:PORT=3100`).

Versão de produção local:

```bash
npm run build
```

```bash
npm start
```

Os dados ficam em `./data` (ou na pasta definida em `DATA_DIR`).

### Variáveis de ambiente

| Variável | Para quê | Padrão |
|---|---|---|
| `APP_PASSWORD` | Senha de acesso (vazia = sem senha) | vazia |
| `OPENAI_API_KEY` | Chave usada se nenhuma for salva na tela | vazia |
| `DATA_DIR` | Pasta de dados | `./data` (Docker: `/app/data`) |
| `PORT` | Porta | `3000` |
