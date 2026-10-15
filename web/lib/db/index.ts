import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import * as schema from "./schema";

export * as schema from "./schema";

/** Conexão do Drizzle com o schema inteiro. Função de serviço recebe isto por parâmetro (D44). */
export type Db = BetterSQLite3Database<typeof schema> & { $client: Database.Database };

export interface OpcoesDb {
  /** Falha se o arquivo não existir, em vez de criar um banco vazio. */
  fileMustExist?: boolean;
}

/** Abre (ou cria) o banco no caminho dado: WAL e chaves estrangeiras ligadas. */
export function createDb(caminho: string, opcoes: OpcoesDb = {}): Db {
  if (caminho !== ":memory:" && !opcoes.fileMustExist) {
    fs.mkdirSync(path.dirname(path.resolve(caminho)), { recursive: true });
  }
  const sqlite = new Database(caminho, { fileMustExist: opcoes.fileMustExist ?? false });
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  return drizzle(sqlite, { schema }) as Db;
}

// Um por processo. No `next dev` o módulo é recarregado a cada edição: o globalThis segura a conexão.
const global = globalThis as typeof globalThis & { __db?: { caminho: string; db: Db } };

/**
 * Banco do servidor, lido de DB_PATH. Só rota e página chamam; serviço recebe `db`.
 * Abre na primeira chamada (o build não depende do banco) e falha se DB_PATH faltar (D04).
 */
export function getDb(): Db {
  const caminho = process.env.DB_PATH?.trim();
  if (!caminho) {
    throw new Error(
      "DB_PATH não definido. Use os scripts do package.json (dev:s1, dev:s2, dev:s3, start, run:sN), " +
        "que fixam o banco de cada janela. O .env não traz DB_PATH de propósito (D04).",
    );
  }
  if (global.__db?.caminho === caminho) return global.__db.db;
  if (!fs.existsSync(caminho)) {
    throw new Error(`Banco não encontrado em "${caminho}". Rode npm run db:rebuild e npm run db:clone.`);
  }
  const db = createDb(caminho, { fileMustExist: true });
  global.__db = { caminho, db };
  return db;
}
