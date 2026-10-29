import { expect, test, type Page } from "@playwright/test";

const DEMO_EMAIL = process.env.E2E_EMAIL ?? "ana@pizzahealth.app";
const DEMO_PASSWORD = process.env.E2E_PASSWORD ?? "pizza-health-demo-2026";
const BASE = (process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

async function login(page: Page) {
  await page.goto(`${BASE}/entrar`);
  await page.getByLabel("E-mail", { exact: true }).fill(DEMO_EMAIL);
  await page.getByLabel("Senha", { exact: true }).fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/inicio$/, { timeout: 30_000 });
}

function appleHealthXml(): Buffer {
  const day = (offset: number) =>
    new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10);
  const record = (type: string, unit: string, value: string, date: string, time: string) =>
    `<Record type="${type}" unit="${unit}" value="${value}" startDate="${date} ${time} -0300" endDate="${date} ${time} -0300"/>`;
  const records: string[] = [];
  for (let index = 1; index <= 4; index += 1) {
    const date = day(index);
    records.push(record("HKQuantityTypeIdentifierDietaryWater", "mL", "1400", date, "10:00:00"));
    records.push(record("HKQuantityTypeIdentifierStepCount", "count", "7600", date, "20:00:00"));
  }
  return Buffer.from(
    `<?xml version="1.0" encoding="UTF-8"?>\n<HealthData locale="pt_BR">\n${records.join("\n")}\n</HealthData>`,
    "utf8",
  );
}


function bigAppleHealthXml(): Buffer {
  const day = (offset: number) =>
    new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10);
  const records: string[] = [];
  for (let index = 0; index < 78_000; index += 1) {
    const date = day((index % 60) + 1);
    records.push(
      `<Record type="HKQuantityTypeIdentifierStepCount" unit="count" value="${(index % 900) + 10}" startDate="${date} 08:00:00 -0300" endDate="${date} 08:00:00 -0300"/>`,
    );
  }
  return Buffer.from(
    `<?xml version="1.0" encoding="UTF-8"?>\n<HealthData locale="pt_BR">\n${records.join("\n")}\n</HealthData>`,
    "utf8",
  );
}

test("passkey: cadastra, entra sem senha e remove", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "Autenticador virtual via CDP roda no desktop.");
  const cdp = await context.newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      ctap2Version: "ctap2_1",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });

  await login(page);
  await page.goto(`${BASE}/perfil/seguranca`);
  await page.getByPlaceholder("Ex.: MacBook da Ana").fill("Passkey E2E");
  await page.getByRole("button", { name: "Cadastrar passkey" }).click();
  await expect(page.getByText("Passkey cadastrada", { exact: false })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText("Passkey E2E").first()).toBeVisible({ timeout: 30_000 });

  await context.clearCookies();
  await page.goto(`${BASE}/entrar`);
  await page.getByRole("button", { name: "Entrar com passkey" }).click();
  await expect(page).toHaveURL(/\/inicio$/, { timeout: 30_000 });

  await page.goto(`${BASE}/perfil/seguranca`);
  const row = page.getByText("Passkey E2E").first().locator("xpath=ancestor::li[1]");
  await row.getByRole("button", { name: "Remover" }).click();
  await expect(page.getByText("Passkey E2E")).toHaveCount(0, { timeout: 30_000 });
});

test("Apple Saúde: prévia, importação e reversão", async ({ page }) => {
  await login(page);
  await page.goto(`${BASE}/perfil/importar`);
  await page.setInputFiles('input[type="file"]', {
    name: "export.xml",
    mimeType: "application/xml",
    buffer: appleHealthXml(),
  });
  await page.getByRole("button", { name: "Analisar arquivo" }).click();
  await expect(page.getByText("Prévia da importação")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Dias com dados")).toBeVisible();

  await page.getByRole("button", { name: "Confirmar importação" }).click();
  await expect(page.getByText("Importação concluída", { exact: false })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText("Nenhum ponto de ranking foi adicionado por importação.")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: "Desfazer" }).first()).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "Desfazer" }).first().click();
  await expect(page.getByText("desfeita", { exact: false }).first()).toBeVisible({
    timeout: 30_000,
  });
});

test("Pizza Auth: login por senha continua disponível como alternativa", async ({ page }) => {
  await page.goto(`${BASE}/entrar`);
  await expect(page.getByRole("button", { name: "Entrar com passkey" })).toBeVisible();
  await expect(page.getByLabel("E-mail", { exact: true })).toBeVisible();
});

test("Apple Saúde: aceita export.xml acima de 10 MB sem truncar", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "Arquivo grande; roda uma vez no desktop.");
  await login(page);
  await page.goto(`${BASE}/perfil/importar`);
  const buffer = bigAppleHealthXml();
  expect(buffer.length).toBeGreaterThan(10 * 1024 * 1024);
  await page.setInputFiles('input[type="file"]', {
    name: "export.xml",
    mimeType: "application/xml",
    buffer,
  });
  await page.getByRole("button", { name: "Analisar arquivo" }).click();
  await expect(page.getByText("Prévia da importação")).toBeVisible({ timeout: 120_000 });
  await expect(page.getByText("Dias com dados")).toBeVisible();
  await page.getByRole("button", { name: "Cancelar" }).click();
});
