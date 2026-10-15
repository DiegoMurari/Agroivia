import { defineConfig } from "@playwright/test";

// Fumaça contra a demo que o HUMANO sobe (npm run build; npm run start, porta 8000).
// Este arquivo não sobe servidor. Só a janela geral roda: npm run e2e.
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:8000",
    browserName: "chromium",
    trace: "retain-on-failure",
  },
});
