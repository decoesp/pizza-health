import { expect, test, type Page } from "@playwright/test";

const DEMO_EMAIL = process.env.E2E_EMAIL ?? "ana@pizzahealth.app";
const DEMO_PASSWORD = process.env.E2E_PASSWORD ?? "pizza-health-demo-2026";

async function login(page: Page) {
  await page.goto("/entrar");
  await page.getByLabel("E-mail", { exact: true }).fill(DEMO_EMAIL);
  await page.getByLabel("Senha", { exact: true }).fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/inicio$/, { timeout: 30_000 });
}

test("landing apresenta proposta e privacidade", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Cuidar de você fica mais leve/i }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Criar minha conta/i }).first()).toBeVisible();
  await expect(page.getByText(/Privacidade estrutural/i).first()).toBeVisible();
  await expect(page.locator("main")).not.toBeEmpty();
});

test("roteiro autenticado exige login", async ({ page }) => {
  await page.goto("/inicio");
  await expect(page).toHaveURL(/\/entrar\?next=%2Finicio/);
});

test("download de documento sem sessão retorna 401", async ({ page }) => {
  const response = await page.request.get("/api/documents/inexistente/download");
  expect(response.status()).toBe(401);
});

test("login demo abre o painel", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Ana");
  await expect(page.getByText(/Hábitos hoje/i).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mesa de Domingo" })).toBeVisible();
});

test("registro rápido de água persiste", async ({ page }) => {
  await login(page);
  await page.goto("/habitos");
  const input = page.getByLabel("Quantos ml você bebeu?");
  await expect(input).toBeVisible();
  await input.fill("2600");
  const form = input.locator("xpath=ancestor::form");
  await form.getByRole("button", { name: /Registrar|Atualizar/ }).click();
  await expect(page.getByText("2,6 L").first()).toBeVisible({ timeout: 30_000 });
});

test("publicação na comunidade aparece no feed", async ({ page }) => {
  await login(page);
  await page.goto("/comunidade/mesa-de-domingo");
  const body = `Publicação de teste E2E ${Date.now()}`;
  await page.getByLabel("Publicação", { exact: true }).fill(body);
  await page.getByRole("button", { name: "Publicar", exact: true }).click();
  await expect(page.getByText(body).first()).toBeVisible({ timeout: 30_000 });
});

test("ranking mostra participação e não expõe exames", async ({ page }) => {
  await login(page);
  await page.goto("/ranking");
  await expect(
    page.getByRole("heading", { name: /Ranking de participação/i }),
  ).toBeVisible();
  await expect(page.getByText(/Nunca por exames, diagnóstico, peso/i)).toBeVisible();
  const text = await page.locator("main").innerText();
  expect(text).not.toMatch(/hemoglobina|leucócitos|plaquetas/i);
});

test("layout móvel não cria rolagem horizontal", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Verificação exclusiva do viewport móvel.");
  await login(page);
  for (const path of ["/inicio", "/habitos", "/exames", "/comunidade"]) {
    await page.goto(path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(overflow, `${path} criou rolagem horizontal`).toBe(false);
  }
});
