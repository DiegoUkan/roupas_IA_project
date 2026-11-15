// Catálogos usados tanto no navegador quanto no servidor (sem dependências de Node).

export type Pose = {
  id: string;
  nome: string;
  /** Trecho do prompt (em inglês, os modelos respondem melhor). */
  prompt: string;
  /** Corpo inteiro: pede margem acima da cabeça e abaixo dos pés. */
  corpoInteiro: boolean;
};

export const POSES: Pose[] = [
  { id: "frente", nome: "Frente, em pé", corpoInteiro: true, prompt: "full body shot, standing straight and facing the camera, arms relaxed naturally" },
  { id: "costas", nome: "Costas", corpoInteiro: true, prompt: "full body shot from behind, back view clearly showing the back of the garment, head slightly turned to the side" },
  { id: "perfil", nome: "Perfil lateral", corpoInteiro: true, prompt: "full body side profile view, standing naturally" },
  { id: "tres-quartos", nome: "Três-quartos", corpoInteiro: true, prompt: "full body, body turned at a three-quarter angle toward the camera" },
  { id: "mao-cintura", nome: "Mão na cintura", corpoInteiro: true, prompt: "full body, one hand resting on the hip, confident relaxed posture" },
  { id: "caminhando", nome: "Caminhando", corpoInteiro: true, prompt: "full body, walking toward the camera mid-stride with natural movement" },
  { id: "sentada", nome: "Sentada", corpoInteiro: true, prompt: "sitting on a simple minimal stool, the whole garment clearly visible" },
  { id: "ombro", nome: "Olhando por cima do ombro", corpoInteiro: true, prompt: "three-quarter back view, looking back over the shoulder toward the camera" },
  { id: "meio-corpo", nome: "Meio corpo / detalhe", corpoInteiro: false, prompt: "waist-up framing, fabric texture and garment details clearly visible" },
  { id: "relaxada", nome: "Relaxada, mãos no bolso", corpoInteiro: true, prompt: "full body, relaxed casual stance with hands in the pockets (or resting naturally if the garment has no pockets)" },
  { id: "girando", nome: "Girando (movimento)", corpoInteiro: true, prompt: "full body, gently twirling so the fabric flows with natural movement" },
  { id: "parede", nome: "Encostada na parede", corpoInteiro: true, prompt: "full body, casually leaning with one shoulder against a wall" },
];

export const DEFAULT_POSES = ["frente", "costas", "tres-quartos", "caminhando"];

export type Fundo = { id: string; nome: string; prompt: string };

export const FUNDOS: Fundo[] = [
  { id: "estudio-branco", nome: "Estúdio branco", prompt: "seamless pure white photo studio background with soft even lighting" },
  { id: "estudio-cinza", nome: "Estúdio cinza claro", prompt: "seamless light gray photo studio background with soft even lighting" },
  { id: "estudio-bege", nome: "Estúdio bege / areia", prompt: "seamless warm beige, sand-colored photo studio background with soft lighting" },
  { id: "concreto", nome: "Parede de concreto", prompt: "minimalist smooth concrete wall background with soft natural light" },
  { id: "rua", nome: "Rua urbana desfocada", prompt: "stylish urban street with a softly blurred background, daylight" },
  { id: "cafe", nome: "Café / interior aconchegante", prompt: "cozy modern café interior with a softly blurred background and warm natural light" },
  { id: "jardim", nome: "Jardim / natureza", prompt: "lush garden with greenery softly blurred in the background, natural daylight" },
  { id: "praia", nome: "Praia", prompt: "bright beach with sand and sea softly blurred in the background, sunny daylight" },
  { id: "loft", nome: "Loft minimalista", prompt: "minimalist bright loft interior with large windows, softly blurred, editorial look" },
  { id: "original", nome: "Manter fundo original", prompt: "keep the original background of the photo, but clean it up: remove clutter and distractions and improve the lighting" },
];

export const DEFAULT_FUNDO = "estudio-branco";

export const QUALIDADES = [
  { id: "auto", nome: "Automática" },
  { id: "low", nome: "Baixa (mais barata)" },
  { id: "medium", nome: "Média" },
  { id: "high", nome: "Alta" },
  { id: "xhigh", nome: "Muito alta (GPT Image 2.5+)" },
  { id: "max", nome: "Máxima (GPT Image 2.5+)" },
];

export type Proporcao = { id: string; nome: string; largura: number; altura: number };

export const PROPORCOES: Proporcao[] = [
  { id: "3:4", nome: "3:4 vertical (recomendado para loja)", largura: 1152, altura: 1536 },
  { id: "4:5", nome: "4:5 vertical", largura: 1280, altura: 1600 },
  { id: "2:3", nome: "2:3 vertical", largura: 1024, altura: 1536 },
  { id: "1:1", nome: "1:1 quadrada", largura: 1024, altura: 1024 },
];

export const MODELOS_SUGERIDOS = [
  "gpt-image-2.6-sunburst",
  "gpt-image-2.6-flare",
  "gpt-image-2.5-sunburst",
  "gpt-image-2.5-flare",
  "gpt-image-2",
];

export function poseById(id: string) {
  return POSES.find((p) => p.id === id);
}

export function fundoById(id: string) {
  return FUNDOS.find((f) => f.id === id);
}

export function proporcaoById(id: string) {
  return PROPORCOES.find((p) => p.id === id) ?? PROPORCOES[0];
}

export const LIMITES = {
  variacoesMax: 4,
  fotosPorPecaMax: 6,
  arquivosPorLoteMax: 300,
  tamanhoArquivoMaxMB: 30,
  simultaneasMax: 6,
};
