import "./_env";
import { closeDb, dbMode, execute, query } from "../src/lib/db";
import { migrate } from "../src/lib/db/migrate";

const TABLES = [
  "data_requests",
  "audit_events",
  "notifications",
  "point_transactions",
  "achievements",
  "challenge_participants",
  "challenges",
  "vaccine_records",
  "exam_results",
  "laboratory_exams",
  "document_shares",
  "document_blobs",
  "health_documents",
  "personal_goals",
  "habit_entries",
  "habit_types",
  "content_reports",
  "reactions",
  "comments",
  "posts",
  "sharing_preferences",
  "community_members",
  "communities",
  "password_resets",
  "sessions",
  "legal_acceptances",
  "users",
];

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DB_RESET !== "1") {
    throw new Error(
      "db:reset bloqueado em produção. Defina ALLOW_DB_RESET=1 conscientemente.",
    );
  }
  console.log(`[reset] limpando dados em modo ${dbMode()}`);
  for (const table of TABLES) {
    await execute(`DELETE FROM ${table}`);
  }
  await migrate();
  const rows = await query<{ total: unknown }>(
    "SELECT COUNT(*) AS total FROM users",
  );
  console.log(`[reset] concluído. users=${Number(rows[0]?.total ?? 0)}`);
  await closeDb();
}

main().catch(async (error) => {
  console.error("[reset] falhou:", error instanceof Error ? error.message : error);
  await closeDb();
  process.exit(1);
});
