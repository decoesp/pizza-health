import { existsSync } from "node:fs";

for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  try {
    process.loadEnvFile(file);
  } catch {
    // Arquivo malformado ou já carregado: o schema de ambiente reporta o erro.
  }
}
