# Editor de Imagens IA — Loja de Roupas

Documento vivo do projeto: objetivo, decisões, especificação, arquitetura, alternativas de IA e andamento.
Atualize as seções **Status**, **Roadmap** e **Histórico de decisões** sempre que algo mudar.

---

## 1. Objetivo

Um sistema para transformar, de forma rápida, as fotos de roupas tiradas durante o dia em **imagens bonitas e padronizadas para o site da loja**.

- Subir **uma ou várias** fotos de uma vez.
- Clicar em **Gerar** e o sistema cria as imagens sozinho, **sem precisar escrever descrição** (a descrição é opcional).
- Usar modelos de IA de imagem via API (começando pelo **OpenAI GPT Image**), com **URL da API, chave e modelo configuráveis pelo próprio usuário**.
- Escolher **poses** (12 opções) com um conjunto de **poses padrão** para ser rápido.
- Configurar **quantas imagens** gerar.
- Subir uma **carga em lote** com muitas fotos de várias roupas; o sistema agrupa por nome de arquivo e processa tudo automaticamente.

---

## 2. Status

| Item | Situação |
|---|---|
| Planejamento e alinhamento | Concluído (11/11/2026) |
| Padrões assumidos (seção 4) | Aceitos com o "pode começar" (15/11/2026) |
| Desenvolvimento | Fases 1 e 2 prontas, Fase 3 quase toda (15/11/2026) — falta testar com a API real e no Docker |
| Como rodar | Ver [README.md](README.md) |

---

## 3. Decisões alinhadas

| Tema | Decisão |
|---|---|
| Tipo de foto de entrada | Foto de **uma pessoa já vestindo a roupa**. A IA **melhora a imagem** e **troca o rosto** pelo de uma modelo da marca. |
| Modelo (pessoa) nas imagens | **Modelos salvas da marca**: ela cadastra uma ou mais modelos (foto de referência) e escolhe qual usar em cada lote. |
| Fundo | **Escolhido por lote** a partir de uma lista pronta, com um **fundo padrão** configurável. |
| Onde roda | **Servidor Docker** (decidido em 15/11/2026, substitui "no PC"). Acesso pelo navegador do PC ou do celular. Senha opcional (`APP_PASSWORD`). |
| Provedor inicial | **OpenAI GPT Image** (versão mais recente: 2.6). Arquitetura preparada para outros provedores. |
| Idioma | Interface toda em **português**. |

---

## 4. Padrões adotados

1. **Nome dos arquivos no lote:** `CODIGO_numero.jpg` — tudo antes do **último `_`** é a peça. Também aceita **uma pasta por roupa** (o nome da pasta é a peça).
2. **Poses padrão:** Frente, Costas, Três-quartos, Caminhando (editável nas configurações).
3. **Variações por pose:** 1 (configurável, até 4).
4. **Formato de saída:** vertical **3:4** (1152×1536) por padrão; opções 4:5, 2:3 e 1:1. JPG.
5. **Nome dos arquivos gerados:** `CODIGO_pose_variacao.jpg`; download do lote inteiro em **ZIP** (uma pasta por peça).
6. **Fila no servidor:** o lote continua rodando mesmo se o navegador for fechado; até 3 tentativas automáticas (espera de 15 s, depois 30 s) para falhas temporárias.
7. **Senha opcional** pela variável `APP_PASSWORD` (sem ela, o sistema abre direto).
8. **Stack:** Node.js 26 + Next.js 16 + SQLite embutido do Node (`node:sqlite`) + sharp.
9. **Qualidade padrão:** alta. **Modelo padrão:** `gpt-image-2.6-sunburst`. **Gerações simultâneas:** 2.

---

## 5. Perguntas em aberto

- [x] Trocar **só o rosto** ou **rosto + cabelo**? → implementado como opção por modelo da marca (padrão: rosto + cabelo).
- [ ] Qual a **plataforma do site** (Nuvemshop, Shopify, Tray, Loja Integrada…)? Útil para tamanho ideal das imagens e, no futuro, envio automático.
- [ ] Existe um **limite de gasto mensal** com a API que o sistema deve respeitar/avisar?

---

## 6. Funcionalidades (escopo)

### 6.1 Geração rápida (avulsa)
- Arrastar/selecionar 1+ fotos (no PC ou direto da galeria/câmera do celular).
- Escolher (ou manter os padrões de): poses, fundo, modelo da marca, nº de variações.
- Descrição **opcional** (ex.: "vestido de linho, destacar o decote").
- Botão **Gerar**. Acompanhar o progresso e ver os resultados lado a lado com a original.

### 6.2 Carga em lote
- Subir muitas fotos de uma vez (ou uma pasta / ZIP).
- O sistema **agrupa as fotos por peça** pela convenção de nomes (seção 7) e mostra a lista de peças encontradas para conferência.
- Botão **Processar lote**: gera todas as peças × poses × variações automaticamente.
- Painel de progresso por peça (pendente / gerando / pronto / erro) com opção de **refazer** uma imagem específica.
- Download em ZIP, organizado por peça.

### 6.3 Poses
- 12 poses pré-definidas (seção 8). Ela marca quais quer; existe um conjunto **padrão** usado com um clique.

### 6.4 Fundos
- Lista de fundos prontos (seção 9) + opção de **manter o fundo original** (só limpar/melhorar). Um fundo padrão configurável.

### 6.5 Modelos da marca
- Cadastro de modelos: nome + 1 a 3 fotos de referência do rosto.
- Opção de **gerar uma modelo fictícia** pelo próprio sistema (recomendado — evita questões de direito de imagem).
- Escolha da modelo por lote; uma modelo padrão.

### 6.6 Configurações
- **Provedor** (OpenAI na v1), **URL base da API**, **chave da API**, **modelo** (ex.: `gpt-image-2.6-sunburst`).
- Botão **Testar conexão**.
- Qualidade (`low` / `medium` / `high` / `xhigh` / `max` / `auto`), proporção de saída, poses padrão, fundo padrão, variações por pose, nº de gerações simultâneas.
- A chave fica salva **só no PC** e nunca é exibida inteira depois de salva.

### 6.7 Histórico
- Lista de lotes anteriores com miniaturas, para baixar de novo ou refazer.

---

## 7. Convenção de nomes (carga em lote)

**Regra:** tudo antes do **último `_`** identifica a peça; o que vem depois é só o número da foto.

```
VESTIDO-FLORAL_1.jpg   ┐
VESTIDO-FLORAL_2.jpg   ┘→ peça "VESTIDO-FLORAL" (2 fotos)
CALCA-JEANS-01_1.jpg    → peça "CALCA-JEANS-01" (1 foto)
BLUSA_SEDA_AZUL_1.jpg   → peça "BLUSA_SEDA_AZUL"
```

**Alternativa por pastas:**

```
lote/
├── VESTIDO-FLORAL/   (qualquer nome de arquivo dentro)
└── CALCA-JEANS-01/
```

- Sem `_` no nome → o nome do arquivo inteiro vira a peça.
- Maiúsculas/minúsculas e acentos são normalizados para agrupar.
- Extensões aceitas: `.jpg`, `.jpeg`, `.png`, `.webp`, `.heic` (convertido).

---

## 8. Catálogo de poses

| # | Pose | Padrão | Dica para o prompt |
|---|---|:---:|---|
| 1 | Frente, em pé | ✅ | full body, standing, facing camera, relaxed arms |
| 2 | Costas | ✅ | full body, back view, showing the back of the garment |
| 3 | Perfil lateral |  | full body, side profile view |
| 4 | Três-quartos | ✅ | full body, three-quarter angle, slight turn |
| 5 | Mão na cintura |  | full body, one hand on hip, confident |
| 6 | Caminhando | ✅ | full body, mid-stride walking toward camera |
| 7 | Sentada |  | sitting on a simple stool, garment fully visible |
| 8 | Olhando por cima do ombro |  | looking over the shoulder, back three-quarter |
| 9 | Meio corpo / detalhe |  | waist-up close-up, fabric texture and details visible |
| 10 | Relaxada, mãos no bolso |  | full body, hands in pockets, casual |
| 11 | Girando (movimento) |  | twirling, skirt/fabric in motion |
| 12 | Encostada na parede |  | leaning against a wall, relaxed |

---

## 9. Catálogo de fundos

| Fundo | Observação |
|---|---|
| Estúdio branco | **Padrão** sugerido para e-commerce |
| Estúdio cinza claro | |
| Estúdio bege / areia | |
| Parede de concreto | Urbano minimalista |
| Rua urbana desfocada | Lifestyle |
| Café / interior aconchegante | Lifestyle |
| Jardim / natureza | Lifestyle |
| Praia | Moda praia / verão |
| Loft minimalista | Editorial |
| Manter fundo original | Só limpa e melhora |

---

## 10. Arquitetura técnica

### 10.1 Stack
- **Next.js 16 (Node.js 26 + React 19)** — interface e API no mesmo projeto; Tailwind CSS 4.
- **SQLite embutido do Node** (`node:sqlite`) — sem dependência nativa extra; arquivo `data/app.db`.
- **sharp** — corrige rotação, limita a 2048 px, converte para JPG e recorta a saída na proporção final.
- **Fila de processamento no servidor** (`src/lib/queue.ts`) — simultaneidade configurável, retentativa com espera, retomada automática quando o servidor reinicia (`src/instrumentation.ts`).
- **Modo simulação** — provedor falso que não chama API nem cobra nada, para testar o fluxo.
- Arquivos em disco: `data/uploads/`, `data/outputs/<lote>/`, `data/modelos/<id>/`.
- Fotos são enviadas **uma a uma** assim que escolhidas (3 por vez), então lotes grandes não viram um pedido gigante.

### 10.2 Implantação e acesso pelo celular
- **Docker:** `Dockerfile` (build em 3 etapas, saída `standalone`) + `docker-compose.yml` com volume `estudio-dados` em `/app/data`.
- Acesso por `http://IP-do-servidor:3000` no PC ou no celular. Com `APP_PASSWORD` definida, páginas e API exigem login (cookie de 90 dias).
- Se o servidor for exposto na internet, usar HTTPS (proxy reverso) e senha.

### 10.2.1 Mapa do código
| Arquivo | Papel |
|---|---|
| `src/lib/catalog.ts` | Poses, fundos, qualidades, proporções, limites |
| `src/lib/prompt.ts` | Monta o prompt de edição e o da modelo fictícia |
| `src/lib/grouping.ts` | Regras de agrupamento por nome/pasta (usado no navegador e no servidor) |
| `src/lib/providers/` | `openai.ts`, `simulacao.ts`, `index.ts` (ponto para novos provedores) |
| `src/lib/queue.ts` | Fila de geração |
| `src/lib/batches.ts` | Criar/listar/detalhar/apagar lotes, refazer imagem, ZIP |
| `src/app/(app)/` | Telas: Gerar, Lotes, Lote, Modelos, Configurações |
| `src/app/api/` | Rotas da API |

### 10.3 Modelo de dados (rascunho)

| Tabela | Campos principais |
|---|---|
| `settings` | provider, base_url, api_key, model, quality, aspect_ratio, default_poses, default_background, variations, concurrency |
| `brand_models` | id, name, reference_images, swap_hair, is_default |
| `batches` | id, created_at, status, background, brand_model_id, description, poses, variations |
| `items` (peças) | id, batch_id, code, source_images |
| `jobs` | id, item_id, pose, variation, status, attempts, error, output_path, cost_estimate |

### 10.4 Camada de provedores
Cada provedor implementa a mesma interface, para trocar/adicionar sem mexer no resto:

```ts
interface ImageProvider {
  id: string;                      // "openai", "fashn", "gemini", "openrouter"...
  testConnection(): Promise<void>;
  generate(input: {
    garmentImages: Buffer[];       // fotos da peça (pessoa vestindo)
    faceReferences: Buffer[];      // fotos da modelo da marca
    prompt: string;
    size: string;                  // ex.: "1024x1536"
    quality: string;
    n: number;
  }): Promise<Buffer[]>;
}
```

**OpenAI (v1):** `POST {base_url}/images/edits` (multipart) com `model`, várias `image[]` (fotos da peça primeiro, depois a referência do rosto), `prompt`, `size`, `quality`, `n=1`, `output_format=jpeg`. URL base padrão: `https://api.openai.com/v1`. Formato validado contra um servidor falso local em 15/11/2026.
- GPT Image **2.5 ou mais novo**: tamanho personalizado exato (múltiplos de 16, ex.: `1152x1536`).
- Modelos mais antigos: tamanhos padrão (`1024x1536`, `1024x1024`) e recorte com sharp.
- Erros traduzidos: 401 (chave), 403 (organização não verificada), 404 (URL/modelo), 429 (limite → tenta de novo; sem créditos → erro), recusa de segurança, 5xx (tenta de novo).

> A interface real ficou com `edit()` e `generate()` (este último para criar a modelo fictícia) e `testConnection()` (chama `GET /models`).

### 10.5 Estratégia de prompt
O prompt é montado automaticamente; a descrição dela (opcional) entra como complemento. Rascunho:

```
Professional e-commerce fashion photo.
Keep the garment from the input photos EXACTLY: same color, fabric, print, cut,
length, buttons, seams and details. Do not add or remove any clothing element.
Replace the person's face{and hair} with the brand model shown in the reference image,
keeping natural skin and realistic proportions.
Pose: {pose}.
Background: {background}.
Soft diffused studio lighting, sharp focus, natural colors, vertical composition.
{descrição opcional}
```

---

## 11. Provedores de IA e alternativas

**Versões da OpenAI:** a mais recente é a **GPT Image 2.6** (lançada em 04/11/2026), com duas variantes — `gpt-image-2.6-sunburst` (mais precisa para edição) e `gpt-image-2.6-flare` (mais rápida). A 2.5 saiu em 08/09/2026; a GPT Image 2 em abril/2026. Não existe "2.7" até o momento.

| Opção | O que é | Por que considerar | Preço aprox. |
|---|---|---|---|
| **OpenAI GPT Image 2.6** | Ponto de partida (v1) | Edição com várias imagens de referência; qualidade até `max` | US$ 30 por milhão de tokens de saída (o valor por imagem depende de tamanho e qualidade) |
| **Google Nano Banana 2** (`gemini-3.1-flash-image`) | Gerador/editor do Google | Avaliações apontam boa consistência de rosto e roupa em poses novas | ~US$ 0,07/img (1K) |
| **FASHN** | Especialista em moda | Tem *model swap* e *face-to-model* — exatamente o fluxo da loja | ~US$ 0,075/img |
| **Seedream (ByteDance)** | Gerador/editor | Indicado para e-commerce, barato | ~US$ 0,03–0,04 |
| **FLUX.2 / Kontext** (Black Forest Labs) | Editor | Prova virtual de roupa, troca de fundo | ~US$ 0,02 (Kontext) |
| **Photoroom / Claid** | APIs de "modelo IA de moda" | Pose, cena e modelo configuráveis | por créditos |
| **OpenRouter / fal.ai** | Agregadores | Uma chave para vários modelos; bom para comparar | varia |
| **ElevenLabs** | Foco em áudio | A API de imagem revende modelos de Google/OpenAI/ByteDance; exige plano Pro; ByteDance precisa de aprovação | igual ao app |

**Recomendação:** começar com **OpenAI**; em seguida adicionar **FASHN** (troca de modelo é o caso dela) e **Nano Banana 2** (comparar consistência do rosto). Preços vêm em boa parte de fontes de terceiros e mudam rápido — conferir no site de cada fornecedor antes de decidir.

---

## 12. Riscos e pontos de atenção

| Risco | Mitigação |
|---|---|
| **Troca de rosto de pessoa real** pode ser recusada pela política do provedor | Usar modelo da marca **fictícia** gerada pelo sistema; testar logo na Fase 1 |
| **Direito de imagem** se a modelo da marca for uma pessoa real | Exigir autorização por escrito; preferir modelo fictícia |
| **IA alterar a roupa** (estampa, cor, detalhes) | Prompt reforçando preservação; revisão antes de publicar; botão "refazer" |
| **Custo** com lotes grandes | Mostrar estimativa antes de processar; limite de gasto configurável |
| **Limite de requisições** da API | Fila com simultaneidade configurável e retentativa com espera |
| **Segurança da chave** | Chave só no servidor, mascarada na interface, nunca enviada ao navegador; `.env` fora da imagem Docker |
| **Proporção 3:4** não suportada nativamente | GPT Image 2.5+: tamanho exato 1152×1536; modelos antigos: gerar 1024×1536 e recortar |
| **Servidor exposto na internet** | Definir `APP_PASSWORD` e usar HTTPS (proxy reverso) |

---

## 13. Roadmap

### Fase 0 — Planejamento ✅
- [x] Levantar requisitos
- [x] Alinhar decisões principais
- [x] Pesquisar alternativas ao GPT Image
- [x] Confirmar padrões assumidos (seção 4)
- [ ] Perguntas em aberto restantes (plataforma do site, limite de gasto)

### Fase 1 — Base funcionando ✅
- [x] Criar projeto Next.js + SQLite
- [x] Tela de configurações (URL, chave, modelo, qualidade) + testar conexão
- [x] Upload de fotos (arrastar, escolher fotos ou pasta; celular abre galeria/câmera)
- [x] Geração com OpenAI (formato validado com servidor falso) + modo simulação
- [x] Ver resultado ao lado da original e baixar
- [ ] **Teste real** com a chave da OpenAI: troca de rosto e fidelidade da roupa

### Fase 2 — Poses, fundos e modelos ✅
- [x] Catálogo de 12 poses + poses padrão
- [x] Catálogo de fundos + fundo padrão
- [x] Cadastro de modelos da marca (upload ou gerar fictícia)
- [x] Variações por pose e descrição opcional

### Fase 3 — Carga em lote (quase pronta)
- [x] Upload de muitas fotos / pasta
- [ ] Upload de arquivo ZIP
- [x] Agrupamento por nome e por pasta, com prévia das peças encontradas
- [ ] Editar o código de uma peça na prévia antes de gerar
- [x] Fila no servidor (simultaneidade, retentativa, refazer item, refazer todos os erros)
- [x] Painel de progresso e download em ZIP

### Fase 4 — Uso no dia a dia
- [x] Acesso pelo celular (servidor Docker; telas responsivas)
- [x] Histórico de lotes
- [ ] Estimativa de custo e limite de gasto (o uso de tokens já é salvo por imagem)
- [x] Senha de acesso opcional (`APP_PASSWORD`)
- [ ] Testar o build da imagem Docker no servidor
- [ ] Limpeza automática de fotos enviadas que não entraram em nenhum lote

### Fase 5 — Outros provedores
- [ ] FASHN
- [ ] Google Nano Banana 2
- [ ] OpenRouter (vários modelos com uma chave)
- [ ] Comparação lado a lado entre provedores

---

## 14. Histórico de decisões

| Data | Decisão |
|---|---|
| 11/11/2026 | Entrada = pessoa vestindo a roupa; IA melhora e troca o rosto pela modelo da marca |
| 11/11/2026 | Modelos da marca salvas, escolhidas por lote |
| 11/11/2026 | Fundo escolhido por lote, com padrão configurável |
| 11/11/2026 | Roda no PC, acesso pelo celular via Wi-Fi |
| 11/11/2026 | Provedor inicial: OpenAI GPT Image (2.6); arquitetura multi-provedor |
| 15/11/2026 | Padrões da seção 4 aceitos; desenvolvimento iniciado |
| 15/11/2026 | Vai rodar em **servidor Docker** (não mais no PC); senha opcional por `APP_PASSWORD` |
| 15/11/2026 | SQLite embutido do Node 26 no lugar de `better-sqlite3` (evita compilar módulo nativo) |
| 15/11/2026 | Troca de cabelo implementada como opção por modelo da marca (padrão: ligado) |
| 15/11/2026 | Modo **simulação** incluído para testar sem gastar |
| 15/11/2026 | Fases 1 e 2 e maior parte da 3 entregues; prévia de agrupamento mostra as peças antes de gerar |

---

## 15. Fontes da pesquisa (11/11/2026)

- [OpenAI – Image generation](https://developers.openai.com/api/docs/guides/image-generation)
- [OpenAI – GPT-Image-2.6 Sunburst](https://developers.openai.com/api/docs/models/gpt-image-2.6-sunburst)
- [SeaArt – GPT Image 2.6 review](https://www.seaart.ai/blog/gpt-image-2-6-review)
- [Google Cloud – Gemini 3.1 Flash Image (Nano Banana 2)](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/3-1-flash-image)
- [Atlas Cloud – Best AI image editing models 2026](https://www.atlascloud.ai/blog/guides/best-ai-image-editing-models-2026)
- [Fuser – Best AI image editing models](https://fuser.studio/articles/best-ai-image-editing-models)
- [FASHN – API pricing](https://help.fashn.ai/plans-and-pricing/api-pricing)
- [Photoroom – Virtual model API](https://www.photoroom.com/api/virtual-model)
- [Claid – AI fashion models](https://claid.ai/api-products/ai-fashion-models)
- [OpenRouter – Image models](https://openrouter.ai/collections/image-models)
- [OpenRouter – Image generation models compared](https://openrouter.ai/blog/insights/image-generation-models-compared/)
- [ElevenLabs – Image, video and templates APIs](https://elevenlabs.io/blog/introducing-the-image-video-and-templates-apis)
