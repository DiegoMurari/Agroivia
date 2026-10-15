import type { Db } from "@/lib/db";

/**
 * Seed do módulo painel. Roda no banco da janela (`npm run seed:painel`) e na matriz (`db:rebuild`).
 * Tem de poder rodar duas vezes sem duplicar. Toda linha com `origem`.
 */
export function seed(db: Db): void {
  void db;
}
