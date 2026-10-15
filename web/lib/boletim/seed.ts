import type { Db } from "@/lib/db";

/**
 * Seed do módulo boletim. Roda no banco da janela (`npm run seed:boletim`) e na matriz (`db:rebuild`).
 * Tem de poder rodar duas vezes sem duplicar. Toda linha com `origem`.
 */
export function seed(db: Db): void {
  void db;
}
