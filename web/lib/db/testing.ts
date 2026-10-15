import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createDb, type Db } from "./index";
import { migrar } from "./migrar";
import { seedFixo } from "./seed/fixo";

export interface TestDb {
  /** Conexão atual. Depois de `reabrir()`, leia `t.db` de novo (não guarde em variável). */
  readonly db: Db;
  readonly caminho: string;
  /** Fecha a conexão (o arquivo fica). */
  fechar(): void;
  /** Fecha e abre o mesmo arquivo: prova de que o dado foi gravado. Devolve a conexão nova. */
  reabrir(): Db;
  /** Fecha e apaga o arquivo e a pasta temporária. Chame no afterEach. */
  apagar(): void;
}

/**
 * Banco de teste (D44): arquivo em pasta temporária do sistema, com as migrações aplicadas.
 * `{ seed: true }` roda o mesmo seed fixo do banco real (armazéns, tipos de item e preços,
 * grade, feriados, parâmetros, norma, equipamentos, usuários). Nunca use data/sN.db em teste.
 */
export function createTestDb(opcoes: { seed?: boolean } = {}): TestDb {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), "recebimento-teste-"));
  const caminho = path.join(pasta, "teste.db");
  let db = createDb(caminho);
  let aberto = true;
  migrar(db);
  if (opcoes.seed) seedFixo(db);

  function fechar(): void {
    if (aberto) db.$client.close();
    aberto = false;
  }

  return {
    get db() {
      return db;
    },
    caminho,
    fechar,
    reabrir() {
      fechar();
      db = createDb(caminho, { fileMustExist: true });
      aberto = true;
      return db;
    },
    apagar() {
      fechar();
      // No Windows o arquivo pode ficar preso por um instante: o rmSync tenta de novo.
      fs.rmSync(pasta, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    },
  };
}
