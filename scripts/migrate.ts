import "./_env";
import { closeDb, dbMode } from "../src/lib/db";
import { migrate } from "../src/lib/db/migrate";

async function main() {
  console.log(`[migrate] modo ${dbMode()}`);
  const { applied } = await migrate();
  if (applied.length === 0) {
    console.log("[migrate] nenhuma migração pendente");
  } else {
    for (const version of applied) console.log(`[migrate] aplicada ${version}`);
  }
  await closeDb();
}

main().catch(async (error) => {
  console.error(
    "[migrate] falhou:",
    error instanceof Error ? error.message : error,
  );
  await closeDb();
  process.exit(1);
});
