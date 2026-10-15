import { defineConfig } from "drizzle-kit";

// Só a janela geral roda drizzle-kit (generate). O banco é migrado pelos scripts db:*.
export default defineConfig({
  dialect: "sqlite",
  schema: "./lib/db/schema.ts",
  out: "./lib/db/migrations",
});
