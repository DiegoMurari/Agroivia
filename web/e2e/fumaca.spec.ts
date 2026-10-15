import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

// Fumaça da demo na porta 8000, contra data/demo.db (npm run db:clone:demo volta ao início).
// Fase 1 (padrão): grava. Fase 2 (E2E_FASE=2, depois de o humano reiniciar o servidor): só recupera.
const FASE_2 = process.env.E2E_FASE === "2";
const LINK = "/agendamento/agendar/demo-compra-1";
// npm run e2e roda dentro de web/ (o package.json é ESM: sem __dirname)
const FIXTURES = path.resolve("lib", "agendamento", "__fixtures__");
// Contas do seed (lib/db/seed/fixo.ts)
const SENHA = process.env.E2E_SENHA ?? "agrovia2026";
const COMPRAS = "compras@agrovia.com.br";
const FORNECEDOR = "fornecedor@demo.com.br";

async function entrar(page: Page, email: string, tipo: "Compras" | "Fornecedor") {
  await page.goto("/login");
  await page.getByRole("radio", { name: new RegExp(`^${tipo}`) }).click();
  await page.getByLabel("E-mail").fill(email);
  await page.locator('input[name="senha"]').fill(SENHA);
  await page.getByRole("button", { name: `Entrar como ${tipo}` }).click();
}

test.describe("login único e permissão por perfil (D49)", () => {
  test("sem sessão, a área de Compras leva ao login e a API responde 401", async ({ page }) => {
    await page.goto("/dia");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { level: 1, name: "Recebimento Inteligente" })).toBeVisible();
    expect((await page.request.get("/api/dia")).status()).toBe(401);
  });

  test("conta de Compras não entra pelo acesso Fornecedor, e o erro não revela a conta", async ({ page }) => {
    await entrar(page, COMPRAS, "Fornecedor");
    await expect(page.getByText("E-mail, senha ou tipo de acesso não conferem.")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("Compras entra, cai na Tela do Dia e não vê a gestão de usuários", async ({ page }) => {
    await entrar(page, COMPRAS, "Compras");
    await expect(page).toHaveURL(/\/dia$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect((await page.request.get("/api/usuarios")).status()).toBe(403);
  });

  test("fornecedor entra no Espaço Fornecedores e não acessa telas de Compras", async ({ page }) => {
    await entrar(page, FORNECEDOR, "Fornecedor");
    await expect(page).toHaveURL(/\/fornecedor/);
    expect((await page.request.get("/api/dia")).status()).toBe(403);
    await page.goto("/painel");
    await expect(page).toHaveURL(/\/fornecedor/);
  });
});

test.describe("área de Compras", () => {
  test.beforeEach(async ({ page }) => {
    await entrar(page, COMPRAS, "Compras");
    await expect(page).toHaveURL(/\/dia$/);
  });

  for (const rota of ["/", "/agendamento", "/dia", "/boletim", "/painel", "/cadastros", "/aprovacoes"]) {
    test(`a rota ${rota} responde`, async ({ page }) => {
      const resposta = await page.goto(rota);
      expect(resposta?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    });
  }
});

test.describe("T1: fornecedor agenda pelo link com duas NF", () => {
  test.skip(FASE_2, "fase 2 só recupera");

  test("anexa 2 XML, vê horário indisponível, escolhe vaga e confirma", async ({ page }) => {
    await page.goto(LINK);
    await expect(page.getByRole("heading", { level: 1, name: "Agendamento de descarga" })).toBeVisible();

    await page
      .getByLabel("Arquivos XML da NF-e")
      .setInputFiles([path.join(FIXTURES, "nfe-palete-com-placa.xml"), path.join(FIXTURES, "nfe-dois-itens.xml")]);
    const acond = page.getByLabel("Acondicionamento desta nota");
    await expect(acond).toHaveCount(2);
    for (const select of await acond.all()) {
      if ((await select.inputValue()) === "") await select.selectOption("paletizado");
    }

    // RF1-03: a grade mostra horário indisponível com motivo
    await expect(page.getByText(/Horário cheio|Reservado a carga batida|Já passou/).first()).toBeVisible();

    const vaga = page.getByRole("button", { name: /\d{2}:\d{2}/ }).and(page.locator(":enabled")).first();
    await vaga.click();
    await page.getByRole("button", { name: "Confirmar agendamento" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Agendamento confirmado" })).toBeVisible();
    await expect(page.getByText("Descarga agendada")).toBeVisible();
    await expect(page.getByRole("link", { name: /^Baixar / })).toHaveCount(2);
  });
});

test("T1: o agendamento gravado é recuperado pelo link", async ({ page }) => {
  await page.goto(LINK);
  await expect(page.getByRole("heading", { level: 1, name: "Agendamento confirmado" })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Baixar / })).toHaveCount(2);
});
