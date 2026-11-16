import path from "node:path";
import { randomBytes } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { DATA_DIR, ensureDirs } from "./paths";

const g = globalThis as unknown as { __estudioDb?: DatabaseSync };

/** Conexão única com o SQLite (arquivo data/app.db). */
export function db(): DatabaseSync {
  if (!g.__estudioDb) {
    ensureDirs();
    const conn = new DatabaseSync(path.join(DATA_DIR, "app.db"));
    conn.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
    migrate(conn);
    g.__estudioDb = conn;
  }
  return g.__estudioDb;
}

function migrate(conn: DatabaseSync) {
  conn.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS uploads (
      id         TEXT PRIMARY KEY,
      file       TEXT NOT NULL,
      name       TEXT NOT NULL,
      width      INTEGER NOT NULL,
      height     INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS brand_models (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      images      TEXT NOT NULL DEFAULT '[]',
      swap_hair   INTEGER NOT NULL DEFAULT 1,
      is_default  INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS batches (
      id             TEXT PRIMARY KEY,
      created_at     TEXT NOT NULL,
      background_id  TEXT NOT NULL,
      brand_model_id TEXT,
      description    TEXT NOT NULL DEFAULT '',
      poses          TEXT NOT NULL,
      variations     INTEGER NOT NULL,
      options        TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS items (
      id            TEXT PRIMARY KEY,
      batch_id      TEXT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
      code          TEXT NOT NULL,
      source_images TEXT NOT NULL,
      position      INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id              TEXT PRIMARY KEY,
      batch_id        TEXT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
      item_id         TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      pose_id         TEXT NOT NULL,
      variation       INTEGER NOT NULL,
      position        INTEGER NOT NULL DEFAULT 0,
      status          TEXT NOT NULL DEFAULT 'pendente',
      attempts        INTEGER NOT NULL DEFAULT 0,
      next_attempt_at INTEGER,
      error           TEXT,
      output_file     TEXT,
      usage           TEXT,
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
    CREATE INDEX IF NOT EXISTS idx_jobs_batch  ON jobs(batch_id);
    CREATE INDEX IF NOT EXISTS idx_items_batch ON items(batch_id);
  `);

  conn.exec(`
    CREATE TABLE IF NOT EXISTS pastas (
      caminho     TEXT PRIMARY KEY,
      nome        TEXT NOT NULL,
      fotos       TEXT NOT NULL DEFAULT '[]',
      processadas TEXT NOT NULL DEFAULT '[]',
      ignorada    TEXT,
      prompt_txt  TEXT,
      visto_em    TEXT NOT NULL,
      ultimo_lote TEXT
    );
  `);

  // Migrações de colunas novas (bancos criados antes delas).
  const colunas = (tabela: string) =>
    (conn.prepare(`PRAGMA table_info(${tabela})`).all() as { name: string }[]).map((c) => c.name);
  const colunasItems = colunas("items");
  if (!colunasItems.includes("product")) conn.exec("ALTER TABLE items ADD COLUMN product TEXT NOT NULL DEFAULT ''");
  // options: { folderPath?, extraPrompt?, backgroundId?, brandModelId? (null = manter pessoa) }
  if (!colunasItems.includes("options")) conn.exec("ALTER TABLE items ADD COLUMN options TEXT NOT NULL DEFAULT '{}'");
  const colunasJobs = colunas("jobs");
  if (!colunasJobs.includes("exported_file")) conn.exec("ALTER TABLE jobs ADD COLUMN exported_file TEXT");
  if (!colunasJobs.includes("review")) conn.exec("ALTER TABLE jobs ADD COLUMN review TEXT");
  if (!colunasJobs.includes("cost_usd")) conn.exec("ALTER TABLE jobs ADD COLUMN cost_usd REAL");
}

export function newId(): string {
  return randomBytes(8).toString("hex");
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Executa várias escritas como uma transação. */
export function transaction<T>(fn: () => T): T {
  const conn = db();
  conn.exec("BEGIN");
  try {
    const result = fn();
    conn.exec("COMMIT");
    return result;
  } catch (err) {
    conn.exec("ROLLBACK");
    throw err;
  }
}
