import fs from "node:fs";
import Database from "better-sqlite3";

import { arquivoAncoraDe } from "@/lib/relogio";

/**
 * Copia a matriz data/base.db para os bancos das janelas e da demo.
 *   npm run db:clone          → s1, s2, s3 e demo
 *   npm run db:clone:s2       → só data/s2.db
 * Cópia consistente por VACUUM INTO (nunca cópia crua do arquivo). Apaga do destino os
 * arquivos -wal e -shm e a âncora do relógio. Falha se o destino estiver em uso.
 */

const BASE = "data/base.db";
const DESTINOS = ["s1", "s2", "s3", "demo"] as const;
type Destino = (typeof DESTINOS)[number];

const SERVIDOR: Record<Destino, string> = {
  s1: "npm run dev:s1 (porta 8001)",
  s2: "npm run dev:s2 (porta 8002)",
  s3: "npm run dev:s3 (porta 8003)",
  demo: "npm run start (porta 8000)",
};

function apagarDestino(destino: Destino): void {
  const caminho = `data/${destino}.db`;
  for (const arquivo of [caminho, `${caminho}-wal`, `${caminho}-shm`, arquivoAncoraDe(caminho)]) {
    try {
      fs.rmSync(arquivo, { force: true });
    } catch {
      throw new Error(
        `${caminho} está em uso. Pare o servidor (${SERVIDOR[destino]}) e repita. ` +
          `Se ele já foi parado, um processo sobreviveu: netstat -ano | findstr :800 e taskkill /PID <pid> /F.`,
      );
    }
  }
}

function main(): void {
  const pedido = process.argv.slice(2);
  const invalido = pedido.find((d) => !(DESTINOS as readonly string[]).includes(d));
  if (invalido) throw new Error(`Destino desconhecido: "${invalido}". Use ${DESTINOS.join(", ")} ou nenhum (todos).`);
  const destinos = (pedido.length ? pedido : [...DESTINOS]) as Destino[];

  if (!fs.existsSync(BASE)) throw new Error(`${BASE} não existe. Rode npm run db:rebuild primeiro.`);

  // Apaga todos antes de copiar: se um destino estiver em uso, nada é copiado pela metade.
  for (const destino of destinos) apagarDestino(destino);

  const base = new Database(BASE, { fileMustExist: true });
  try {
    for (const destino of destinos) {
      const caminho = `data/${destino}.db`;
      base.prepare("VACUUM INTO ?").run(caminho);
      const copia = new Database(caminho, { fileMustExist: true });
      copia.pragma("journal_mode = WAL");
      const { n } = copia.prepare("select count(*) as n from sqlite_master where type = 'table'").get() as { n: number };
      copia.close();
      console.log(`${BASE} → ${caminho} (${n} tabelas, ${(fs.statSync(caminho).size / 1024 / 1024).toFixed(1)} MB)`);
    }
  } finally {
    base.close();
  }
}

try {
  main();
} catch (erro) {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exit(1);
}
