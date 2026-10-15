import path from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import type { Db } from "./index";

/** Aplica as migrações de lib/db/migrations. Só scripts da geral e createTestDb() chamam. */
export function migrar(db: Db): void {
  migrate(db, { migrationsFolder: path.join(process.cwd(), "lib", "db", "migrations") });
}
