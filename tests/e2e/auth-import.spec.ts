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
  await page.waitForLoadState("networkidle");
  await page.setInputFiles('[data-testid="apple-health-file"]', {
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
  test.setTimeout(180_000);
  await login(page);
  await page.goto(`${BASE}/perfil/importar`);
  await page.waitForLoadState("networkidle");
  const buffer = bigAppleHealthXml();
  expect(buffer.length).toBeGreaterThan(10 * 1024 * 1024);
  await page.setInputFiles('[data-testid="apple-health-file"]', {
    name: "export.xml",
    mimeType: "application/xml",
    buffer,
  });
  await page.getByRole("button", { name: "Analisar arquivo" }).click();
  await expect(page.getByText("Prévia da importação")).toBeVisible({ timeout: 120_000 });
  await expect(page.getByText("Dias com dados")).toBeVisible();
  await page.getByRole("button", { name: "Cancelar" }).click();
});

function pdfFile(tag: string): Buffer {
  return Buffer.from(
    `%PDF-1.4
% ${tag}
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj
trailer<</Root 1 0 R>>
%%EOF`,
    "latin1",
  );
}

test("Documentos: envia laudo em PDF e abre a revisão manual", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "Upload de arquivo roda uma vez no desktop.");
  const stamp = Date.now();
  const fileName = `Laudo E2E ${stamp}.pdf`;
  await login(page);
  await page.goto(`${BASE}/perfil/importar`);
  await page.waitForLoadState("networkidle");
  await page.setInputFiles('[data-testid="document-file"]', {
    name: fileName,
    mimeType: "application/pdf",
    buffer: pdfFile(String(stamp)),
  });
  await expect(page.getByTestId("document-title")).toHaveValue(`Laudo E2E ${stamp}`);
  await page.getByRole("button", { name: "Enviar documento" }).click();
  await expect(page).toHaveURL(/\/exames\/doc_/, { timeout: 30_000 });
  await expect(page.getByText(`Laudo E2E ${stamp}`, { exact: false }).first()).toBeVisible();
});
