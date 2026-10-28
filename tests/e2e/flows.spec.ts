import { expect, test, type Page } from "@playwright/test";

const DEMO_EMAIL = process.env.E2E_EMAIL ?? "ana@pizzahealth.app";
const DEMO_PASSWORD = process.env.E2E_PASSWORD ?? "pizza-health-demo-2026";

async function login(page: Page, email: string, password: string) {
  await page.goto("/entrar");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
}

function invitePath(href: string, pageUrl: string) {
  return new URL(href, pageUrl).pathname;
}

test("convite revogado, entrada por link novo e exclusão de conta", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Fluxo destrutivo roda uma única vez.");

  const stamp = Date.now();
  const guestEmail = `e2e-${stamp}@pizzahealth.test`;
  const guestPassword = "PizzaE2E2026!";
  const guestName = `Convidado E2E ${stamp}`;

  await login(page, DEMO_EMAIL, DEMO_PASSWORD);
  await expect(page).toHaveURL(/\/inicio$/, { timeout: 30_000 });

  await page.goto("/comunidade/mesa-de-domingo");
  const generate = page.getByRole("button", { name: "Gerar novo link" });
  await generate.click();

  const link = page.locator('a[href*="/convite/"]').first();
  await expect(link).toBeVisible({ timeout: 30_000 });
  const firstHref = await link.getAttribute("href");
  expect(firstHref).toBeTruthy();

  await generate.click();
  await expect
    .poll(async () => link.getAttribute("href"), { timeout: 30_000 })
    .not.toBe(firstHref);
  const secondHref = await link.getAttribute("href");
  expect(secondHref).toBeTruthy();

  const revoked = invitePath(firstHref!, page.url());
  const valid = invitePath(secondHref!, page.url());

  await context.clearCookies();

  await page.goto(revoked);
  await expect(page.getByRole("heading", { name: "Convite indisponível" })).toBeVisible();
  await expect(page.getByText(/não existe ou foi revogado/i)).toBeVisible();

  await page.goto(valid);
  await expect(
    page.getByRole("heading", { name: /Você foi convidado para Mesa de Domingo/i }),
  ).toBeVisible();

  await page.locator('a[href*="/criar-conta?next="]').click();
  await expect(page.getByRole("heading", { name: "Criar sua conta" })).toBeVisible();
  await page.getByLabel("Nome de exibição").fill(guestName);
  await page.getByLabel("E-mail", { exact: true }).fill(guestEmail);
  await page.getByLabel("Senha", { exact: true }).fill(guestPassword);
  await page.getByLabel("Confirmar senha").fill(guestPassword);
  await page.getByLabel(/Aceito os termos e a política de privacidade/).check();
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();

  await expect(page).toHaveURL(new RegExp(valid.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), {
    timeout: 30_000,
  });
  await page.getByRole("button", { name: /Entrar em Mesa de Domingo/i }).click();
  await expect(page).toHaveURL(/\/comunidade\/mesa-de-domingo$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Mesa de Domingo" })).toBeVisible();

  await page.goto("/perfil/dados");
  await page.getByLabel("Senha atual").fill(guestPassword);
  await page.getByLabel(/Digite "EXCLUIR"/).fill("EXCLUIR");
  await page.getByRole("button", { name: "Excluir minha conta definitivamente" }).click();
  await expect(page).toHaveURL(/\/\?excluida=1$/, { timeout: 30_000 });

  await login(page, guestEmail, guestPassword);
  await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible({ timeout: 30_000 });
  await expect(page).toHaveURL(/\/entrar$/);
});
