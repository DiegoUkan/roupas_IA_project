import { db, newId, nowIso, transaction } from "./db";
import { normalizarUpload } from "./images";
import { fileUrl, removeDataPath, toRel, writeDataFile } from "./paths";

export type BrandModel = {
  id: string;
  name: string;
  description: string;
  images: string[];
  swapHair: boolean;
  isDefault: boolean;
  createdAt: string;
};

export type BrandModelPublic = Omit<BrandModel, "images"> & { imageUrls: string[] };

type Row = {
  id: string;
  name: string;
  description: string;
  images: string;
  swap_hair: number;
  is_default: number;
  created_at: string;
};

function fromRow(r: Row): BrandModel {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    images: JSON.parse(r.images) as string[],
    swapHair: r.swap_hair === 1,
    isDefault: r.is_default === 1,
    createdAt: r.created_at,
  };
}

export function toPublicModel(m: BrandModel): BrandModelPublic {
  const { images, ...rest } = m;
  return { ...rest, imageUrls: images.map(fileUrl) };
}

export function listBrandModels(): BrandModel[] {
  return (db().prepare("SELECT * FROM brand_models ORDER BY is_default DESC, created_at ASC").all() as Row[]).map(fromRow);
}

export function getBrandModel(id: string): BrandModel | null {
  const row = db().prepare("SELECT * FROM brand_models WHERE id = ?").get(id) as Row | undefined;
  return row ? fromRow(row) : null;
}

export function getDefaultBrandModel(): BrandModel | null {
  const row = db().prepare("SELECT * FROM brand_models WHERE is_default = 1 LIMIT 1").get() as Row | undefined;
  return row ? fromRow(row) : null;
}

export async function createBrandModel(input: {
  name: string;
  description: string;
  swapHair: boolean;
  images: Buffer[];
}): Promise<BrandModel> {
  const name = input.name.trim().slice(0, 80);
  if (!name) throw new Error("Dê um nome para a modelo.");
  if (input.images.length === 0) throw new Error("Envie pelo menos uma foto de referência do rosto.");
  if (input.images.length > 3) throw new Error("Use no máximo 3 fotos de referência.");

  const id = newId();
  const rels: string[] = [];
  for (let i = 0; i < input.images.length; i++) {
    const { data } = await normalizarUpload(input.images[i]);
    const rel = toRel("modelos", id, `ref_${i + 1}.jpg`);
    writeDataFile(rel, data);
    rels.push(rel);
  }

  const isFirst = (db().prepare("SELECT COUNT(*) AS n FROM brand_models").get() as { n: number }).n === 0;
  db()
    .prepare(
      "INSERT INTO brand_models (id, name, description, images, swap_hair, is_default, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .run(id, name, input.description.trim().slice(0, 500), JSON.stringify(rels), input.swapHair ? 1 : 0, isFirst ? 1 : 0, nowIso());
  return getBrandModel(id)!;
}

export function updateBrandModel(
  id: string,
  patch: { name?: string; description?: string; swapHair?: boolean; isDefault?: boolean },
): BrandModel {
  const m = getBrandModel(id);
  if (!m) throw new Error("Modelo não encontrada.");
  transaction(() => {
    if (typeof patch.name === "string" && patch.name.trim()) {
      db().prepare("UPDATE brand_models SET name = ? WHERE id = ?").run(patch.name.trim().slice(0, 80), id);
    }
    if (typeof patch.description === "string") {
      db().prepare("UPDATE brand_models SET description = ? WHERE id = ?").run(patch.description.trim().slice(0, 500), id);
    }
    if (typeof patch.swapHair === "boolean") {
      db().prepare("UPDATE brand_models SET swap_hair = ? WHERE id = ?").run(patch.swapHair ? 1 : 0, id);
    }
    if (patch.isDefault === true) {
      db().prepare("UPDATE brand_models SET is_default = CASE WHEN id = ? THEN 1 ELSE 0 END").run(id);
    } else if (patch.isDefault === false) {
      db().prepare("UPDATE brand_models SET is_default = 0 WHERE id = ?").run(id);
    }
  });
  return getBrandModel(id)!;
}

export function deleteBrandModel(id: string) {
  const m = getBrandModel(id);
  if (!m) return;
  db().prepare("DELETE FROM brand_models WHERE id = ?").run(id);
  removeDataPath(toRel("modelos", id));
}
