import AxeBuilder from "@axe-core/playwright";
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

const publicPages = [
  { name: "home", path: "/" },
  { name: "entrar", path: "/entrar" },
  { name: "criar conta", path: "/criar-conta" },
  { name: "privacidade", path: "/privacidade" },
  { name: "termos", path: "/termos" },
];

for (const pageInfo of publicPages) {
  test(`acessibilidade pública: ${pageInfo.name}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "Axe roda uma vez por página no desktop.");
    await page.goto(pageInfo.path);
    await expect(page.locator("main")).not.toBeEmpty();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const serious = results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    );
    expect(
      serious,
      serious
        .map(
          (violation) =>
            `${violation.id} (${violation.nodes.length}): ${violation.nodes
              .slice(0, 3)
              .map((node) => node.target.join(" "))
              .join(" | ")}`,
        )
        .join("\n"),
    ).toEqual([]);
  });
}

const appPages = [
  { name: "inicio", path: "/inicio" },
  { name: "comunidade", path: "/comunidade/mesa-de-domingo" },
  { name: "habitos", path: "/habitos" },
  { name: "exames", path: "/exames" },
  { name: "ranking", path: "/ranking" },
  { name: "perfil", path: "/perfil" },
];

for (const pageInfo of appPages) {
  test(`acessibilidade autenticada: ${pageInfo.name}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "Axe roda uma vez por página no desktop.");
    await login(page);
    await page.goto(pageInfo.path);
    await expect(page.locator("main")).not.toBeEmpty();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const serious = results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    );
    expect(
      serious,
      serious
        .map(
          (violation) =>
            `${violation.id} (${violation.nodes.length}): ${violation.nodes
              .slice(0, 3)
              .map((node) => node.target.join(" "))
              .join(" | ")}`,
        )
        .join("\n"),
    ).toEqual([]);
  });
}
