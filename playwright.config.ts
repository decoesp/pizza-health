import { defineConfig, devices } from "@playwright/test";

const e2eEnv = {
  DB_MODE: "local",
  LOCAL_DB_PATH: ".data/e2e-pizza-health.db",
  NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3000",
  DOCUMENT_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString("base64"),
  RATE_LIMIT_SALT: "e2e-salt-with-enough-length",
  SESSION_DAYS: "30",
  MAX_UPLOAD_BYTES: "8388608",
  SEED_DEMO: "1",
  SEED_DEMO_PASSWORD: "pizza-health-demo-2026",
  ADMIN_EMAIL: "ana@pizzahealth.app",
  ADMIN_PASSWORD: "pizza-health-demo-2026",
  ALLOW_RESET_LINK_IN_UI: "1",
};

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command:
          "rm -f .data/e2e-pizza-health.db .data/e2e-pizza-health.db-shm .data/e2e-pizza-health.db-wal && npm run db:migrate && npm run db:seed && npm run build && npm run start",
        url: "http://127.0.0.1:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 420_000,
        env: e2eEnv,
      },
});
