import { z } from "zod";

const booleanString = z
  .enum(["true", "false", "1", "0"])
  .optional()
  .transform((value) => value === "true" || value === "1");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  DB_MODE: z.enum(["local", "remote"]).default("local"),
  LOCAL_DB_PATH: z.string().min(1).default(".data/pizza-health.db"),
  PIZZA_API_KEY: z.string().min(1).optional(),
  PIZZA_DB: z.string().min(1).default("pizzaria/pizza-health"),
  PIZZA_DB_HOST: z.string().min(1).default("db.database.pizza"),
  PIZZA_DB_PORT: z.coerce.number().int().min(1).max(65535).default(5432),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(5).default(2),
  DOCUMENT_ENCRYPTION_KEY: z.string().min(40).optional(),
  MAX_UPLOAD_BYTES: z.coerce
    .number()
    .int()
    .min(1024)
    .max(11_000_000)
    .default(8_388_608),
  SESSION_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  RATE_LIMIT_SALT: z.string().min(16).optional(),
  SEED_DEMO: booleanString,
  SEED_DEMO_PASSWORD: z.string().min(8).optional(),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),
  ALLOW_RESET_LINK_IN_UI: booleanString,
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Configuração de ambiente inválida: ${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export function resetEnvForTests(): void {
  cached = null;
}

export function siteUrl(): string {
  return getEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
}
