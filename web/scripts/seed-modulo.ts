import { getDb, type Db } from "@/lib/db";

/** Roda lib/<modulo>/seed.ts no banco de DB_PATH (fixado pelo script seed:<modulo> do package.json). */

const MODULOS = ["agendamento", "boletim", "painel"];

async function main(): Promise<void> {
  const modulo = process.argv[2];
  if (!MODULOS.includes(modulo)) throw new Error(`Módulo desconhecido: "${modulo}". Use ${MODULOS.join(", ")}.`);
  const { seed } = (await import(`../lib/${modulo}/seed`)) as { seed: (db: Db) => void };
  const db = getDb();
  seed(db);
  db.$client.close();
  console.log(`Seed do módulo ${modulo} aplicado em ${process.env.DB_PATH}.`);
}

main().catch((erro) => {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
