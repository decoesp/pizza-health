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

test("exportação sem sessão retorna 401", async ({ page }) => {
  const response = await page.request.get("/api/export");
  expect(response.status()).toBe(401);
});

test("exportação de dados não inclui segredos", async ({ page }) => {
  await login(page);
  const response = await page.request.get("/api/export");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  const payload = await response.json();
  expect(payload.formatVersion).toBe(1);
  expect(payload.account.email).toBe(DEMO_EMAIL);
  expect(payload.account).not.toHaveProperty("password_hash");
  expect(JSON.stringify(payload)).not.toMatch(/password_hash|token_hash|passwordHash/i);
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

test("upload, download e exclusão de documento", async ({ page }) => {
  await login(page);
  await page.goto("/exames/enviar");
  const title = `Exame E2E ${Date.now()}`;
  await page.getByLabel("Título do documento").fill(title);
  await page.getByLabel("Arquivo").setInputFiles({
    name: "exame-e2e.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"),
  });
  await page.getByRole("button", { name: "Enviar documento" }).click();
  await expect(page).toHaveURL(/\/exames\/doc_/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 1 })).toContainText(title);

  const downloadUrl = await page
    .getByRole("link", { name: /Baixar original/i })
    .first()
    .getAttribute("href");
  expect(downloadUrl).toBeTruthy();
  const response = await page.request.get(downloadUrl!);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/pdf");

  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Excluir documento" }).click();
  await expect(page).toHaveURL(/\/exames\?removido=1/, { timeout: 30_000 });
});
