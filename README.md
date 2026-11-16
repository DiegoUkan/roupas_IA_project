# Estúdio IA — fotos da loja

Transforma as fotos das roupas tiradas no dia a dia em imagens padronizadas para o site:
melhora a foto, troca o rosto pela **modelo da marca**, aplica **poses** e **fundo**, e gera em lote —
inclusive lendo sozinho as **pastas** onde as fotos são colocadas.

O planejamento completo, as decisões e o andamento estão em [PROJETO.md](PROJETO.md).

---

## Instalar no CasaOS

A imagem Docker é montada automaticamente pelo GitHub a cada push na branch `main`
(workflow `.github/workflows/docker.yml`) e publicada em `ghcr.io/diegoukan/roupas_ia_project:latest`.
O CasaOS só baixa essa imagem.

1. **Primeira vez — liberar a imagem:** depois do primeiro push, abra o repositório no GitHub ›
   **Packages** (lado direito) › `roupas_ia_project` › **Package settings** › **Change visibility** › **Public**.
   (Se preferir deixar privada, o CasaOS precisa fazer login no `ghcr.io` com um token.)
2. No CasaOS: **App Store** › ícone **+** (canto superior direito) › **Install a customized app** ›
   **Import** e cole o conteúdo de [`casaos/estudio-ia.yml`](casaos/estudio-ia.yml).
3. Antes de instalar, **troque a senha** em `APP_PASSWORD`. Se a porta 3000 já estiver em uso, troque o
   primeiro número em `ports` (ex.: `"3080:3000"`).
4. Instale e abra `http://IP-DO-SERVIDOR:3000`.

**Atualizar:** depois de cada push, espere o workflow terminar (aba **Actions** do GitHub) e, no CasaOS,
abra o app › **Settings** › **Update/Recreate** (ou rode `docker pull ghcr.io/diegoukan/roupas_ia_project:latest`
e recrie o container). Os dados ficam nas pastas do servidor e não se perdem.

### Onde ficam os arquivos no servidor

```
/DATA/AppData/estudio-ia/
├── sistema/                 ← banco, configurações, modelos da marca (backup: copie esta pasta)
└── arquivos/
    ├── Para editar/         ← coloque aqui as fotos: UMA PASTA POR PRODUTO
    │   └── Verão/Vestidos/Vestido floral azul/
    │       ├── foto1.jpg
    │       ├── foto2.jpg
    │       └── prompt.txt   ← opcional: instruções só deste produto
    └── Editadas/            ← o sistema grava aqui, no MESMO caminho
        └── Verão/Vestidos/Vestido floral azul/
            ├── Frente.jpg
            ├── Costas.jpg
            └── Frente 2.jpg ← gerar de novo nunca apaga, só adiciona
```

Dá para acessar essas pastas pelo app **Files** do CasaOS ou compartilhá-las na rede (botão de compartilhar
do Files) para abrir direto no PC.

---

## Como usar

### Pelas pastas (lote)
1. Crie uma pasta por produto dentro de **Para editar** (pode organizar em quantos níveis quiser).
   O **nome da pasta** vira o “o que está à venda” — escreva livremente, com espaço e acento.
2. Opcional: um `prompt.txt` na pasta do produto com instruções só para ele.
3. O sistema verifica as pastas **a cada minuto** (ou clique em **Verificar agora**). Aparece
   **“Novas imagens detectadas”** no menu **Pastas** e na tela Gerar.
4. Em **Pastas**, marque os produtos, ajuste o que quiser por produto (poses, fundo, modelo, instruções)
   e clique em **Gerar selecionados**. Antes, aparece o custo estimado.
5. As imagens vão para **Editadas**, no mesmo caminho. Na tela do lote dá para **Aprovar**, **Reprovar**
   (tira da pasta Editadas, guardada numa lixeira interna — dá para **Restaurar**) e **Refazer**.

Foto nova numa pasta já processada aparece de novo como **“fotos novas”**. Fotos que ainda estão sendo
copiadas esperam 20 segundos sem mudar antes de entrar. Pastas que começam com `.` ou `_` são ignoradas.
Até 6 fotos por produto são usadas (as primeiras em ordem de nome).

### Pelo celular
**Novo produto**: tire as fotos, dê o nome, escolha a categoria — o sistema cria a pasta em
**Para editar** e, se marcado, já gera com as opções padrão.

### Modo automático
Em **Configurações**, ligue **Modo automático**: todo produto novo nas pastas entra sozinho na fila com as
poses, o fundo e a modelo padrão.

### Primeiro uso
1. **Configurações** → URL da API, chave e modelo → **Salvar e testar conexão**
   (para testar sem gastar, escolha o provedor **Simulação**).
2. **Configurações › Diretrizes da loja**: regras enviadas em toda geração (enquadramento, trocar chinelo, etc.).
3. **Configurações › Custos**: preços por token (ou valor fixo por imagem) e cotação do dólar.
4. **Modelos** → gere uma modelo fictícia ou envie fotos de referência de quem autorizou o uso da imagem.

---

## Desenvolvimento (no PC)

Requer Node.js 26.

```bash
npm install
```

```bash
npm run dev
```

Produção local:

```bash
npm run build
```

```bash
npm start
```

Porta padrão 3000 (PowerShell: `$env:PORT=3100` antes, se estiver ocupada). Dados em `./data` e pastas de
trabalho em `./arquivos`.

### Variáveis de ambiente

| Variável | Para quê | Padrão |
|---|---|---|
| `APP_PASSWORD` | Senha de acesso (vazia = sem senha) | vazia |
| `OPENAI_API_KEY` | Chave usada se nenhuma for salva na tela | vazia |
| `DATA_DIR` | Banco, configurações, modelos | `./data` (Docker: `/app/data`) |
| `ARQUIVOS_DIR` | Pastas “Para editar” e “Editadas” | `./arquivos` (Docker: `/app/arquivos`) |
| `PORT` | Porta | `3000` |
| `PUID` / `PGID` | Rodar o container com outro usuário (padrão: root) | vazio |
| `PASTAS_ESTAVEL_SEGUNDOS` | Tempo sem mudar para a foto ser considerada copiada | `20` |
| `TZ` | Fuso horário | — |
