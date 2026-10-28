import "./_env";
import { closeDb, dbMode, query } from "../src/lib/db";

const TABLES = [
  "users",
  "sessions",
  "communities",
  "community_members",
  "posts",
  "comments",
  "habit_entries",
  "health_documents",
  "document_blobs",
  "laboratory_exams",
  "exam_results",
  "vaccine_records",
  "challenges",
  "challenge_participants",
  "achievements",
  "point_transactions",
  "notifications",
  "audit_events",
];

async function main() {
  console.log(`[status] modo ${dbMode()}`);
  const migrations = await query<{ version: string; applied_at: string }>(
    "SELECT version, applied_at FROM schema_migrations ORDER BY version",
  );
  console.log(`[status] migrações: ${migrations.map((m) => m.version).join(", ") || "nenhuma"}`);
  for (const table of TABLES) {
    try {
      const rows = await query<{ total: unknown }>(
        `SELECT COUNT(*) AS total FROM ${table}`,
      );
      console.log(`  ${table.padEnd(24)} ${Number(rows[0]?.total ?? 0)}`);
    } catch (error) {
      console.log(`  ${table.padEnd(24)} erro: ${error instanceof Error ? error.message : error}`);
    }
  }
  await closeDb();
}

main().catch(async (error) => {
  console.error("[status] falhou:", error instanceof Error ? error.message : error);
  await closeDb();
  process.exit(1);
});
