import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)).replace(/[\/]$/, "") },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "scripts/**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**", ".next-s1/**", ".next-s2/**", ".next-s3/**", "data/**"],
    pool: "forks",
    setupFiles: ["./vitest.setup.ts"],
  },
});
