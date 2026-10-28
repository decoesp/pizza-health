import { execute, query, withTransaction, nowIso } from "@/lib/db";
import { MIGRATIONS } from "@/lib/db/schema";

export async function migrate(): Promise<{ applied: string[] }> {
  await execute(
    "CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL)",
  );
  const rows = await query<{ version: string }>(
    "SELECT version FROM schema_migrations",
  );
  const appliedSet = new Set(rows.map((row) => String(row.version)));
  const applied: string[] = [];

  for (const migration of MIGRATIONS) {
    if (appliedSet.has(migration.version)) continue;
    await withTransaction(async (tx) => {
      for (const statement of migration.statements) {
        await tx.execute(statement);
      }
      await tx.execute(
        "INSERT INTO schema_migrations (version, applied_at) VALUES (?,?)",
        [migration.version, nowIso()],
      );
    });
    applied.push(migration.version);
  }

  return { applied };
}
