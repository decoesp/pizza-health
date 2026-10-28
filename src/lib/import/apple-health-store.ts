import "server-only";
import { execute, newId, nowIso, query, queryOne, withTransaction } from "@/lib/db";
import { ensureDefaultHabits, listHabitTypes } from "@/lib/data/habits";
import type { AppleHealthDay, AppleHealthPreview, AppleHealthSummary } from "@/lib/import/apple-health";

export type StoredImport = {
  id: string;
  filename: string;
  status: "preview" | "applied" | "undone" | "failed";
  createdAt: string;
  appliedAt: string | null;
  summary: AppleHealthSummary & {
    imported?: number;
    skipped?: number;
  };
};

type ImportRow = {
  id: string;
  user_id: string;
  filename: string;
  status: StoredImport["status"];
  payload: string;
  summary: string;
  created_at: string;
  applied_at: string | null;
  undone_at: string | null;
};

export async function savePreview(
  userId: string,
  filename: string,
  preview: AppleHealthPreview,
): Promise<string> {
  const now = new Date();
  const expires = new Date(now.getTime() - 24 * 60 * 60_000);
  await execute(
    "DELETE FROM apple_health_imports WHERE user_id = ? AND status = 'preview' AND created_at < ?",
    [userId, expires.toISOString()],
  );
  const id = newId("ahi");
  await execute(
    `INSERT INTO apple_health_imports (id, user_id, filename, status, payload, summary, created_at, applied_at, undone_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [
      id,
      userId,
      filename.slice(0, 200),
      "preview",
      JSON.stringify(preview.days),
      JSON.stringify(preview.summary),
      now.toISOString(),
      null,
      null,
    ],
  );
  return id;
}

export async function getImport(
  userId: string,
  id: string,
): Promise<{ row: ImportRow; days: AppleHealthDay[]; summary: StoredImport["summary"] } | null> {
  const row = await queryOne<ImportRow>(
    "SELECT * FROM apple_health_imports WHERE id = ? AND user_id = ? LIMIT 1",
    [id, userId],
  );
  if (!row) return null;
  let days: AppleHealthDay[] = [];
  try {
    days = JSON.parse(row.payload) as AppleHealthDay[];
  } catch {
    days = [];
  }
  let summary = {} as StoredImport["summary"];
  try {
    summary = JSON.parse(row.summary) as StoredImport["summary"];
  } catch {
    summary = {
      startDate: null,
      endDate: null,
      totalDays: 0,
      waterDays: 0,
      sleepDays: 0,
      movementDays: 0,
      stepDays: 0,
      recordsSeen: 0,
      ignoredRecords: 0,
    };
  }
  return { row, days, summary };
}

export async function listImports(userId: string, limit = 10): Promise<StoredImport[]> {
  const rows = await query<ImportRow>(
    "SELECT * FROM apple_health_imports WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
    [userId, limit],
  );
  return rows.map((row) => {
    let summary: StoredImport["summary"];
    try {
      summary = JSON.parse(row.summary) as StoredImport["summary"];
    } catch {
      summary = {
        startDate: null,
        endDate: null,
        totalDays: 0,
        waterDays: 0,
        sleepDays: 0,
        movementDays: 0,
        stepDays: 0,
        recordsSeen: 0,
        ignoredRecords: 0,
      };
    }
    return {
      id: String(row.id),
      filename: String(row.filename),
      status: row.status,
      createdAt: String(row.created_at),
      appliedAt: row.applied_at ? String(row.applied_at) : null,
      summary,
    };
  });
}

async function ensureStepsHabit(userId: string): Promise<void> {
  await ensureDefaultHabits(userId);
  const existing = await queryOne<{ id: string }>(
    "SELECT id FROM habit_types WHERE user_id = ? AND slug = 'passos' LIMIT 1",
    [userId],
  );
  if (existing) return;
  await execute(
    "INSERT INTO habit_types (id, user_id, slug, name, unit, icon, target_value, direction, active, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
    [newId("hab"), userId, "passos", "Passos", "passos", "move", 8000, "at_least", 1, nowIso()],
  );
}

export type ApplyResult = {
  imported: number;
  skipped: number;
  byMetric: Record<string, number>;
};

export async function applyImport(userId: string, id: string): Promise<ApplyResult> {
  const stored = await getImport(userId, id);
  if (!stored) throw new Error("Importação não encontrada.");
  if (stored.row.status !== "preview") {
    throw new Error("Esta importação já foi aplicada ou desfeita.");
  }
  const previewAge = Date.now() - new Date(stored.row.created_at).getTime();
  if (!Number.isFinite(previewAge) || previewAge > 24 * 60 * 60_000) {
    await execute(
      "UPDATE apple_health_imports SET status = 'failed' WHERE id = ? AND user_id = ? AND status = 'preview'",
      [id, userId],
    );
    throw new Error("Prévia expirada. Envie o arquivo novamente.");
  }
  if (stored.days.length === 0) throw new Error("Importação sem dados.");

  await ensureStepsHabit(userId);
  const habits = await listHabitTypes(userId);
  const bySlug = new Map(habits.map((habit) => [habit.slug, habit]));
  const mapping: Array<{ key: keyof AppleHealthDay; slug: string }> = [
    { key: "waterMl", slug: "agua" },
    { key: "sleepHours", slug: "sono" },
    { key: "movementMinutes", slug: "movimento" },
    { key: "steps", slug: "passos" },
  ];

  let imported = 0;
  let skipped = 0;
  const byMetric: Record<string, number> = {};
  const now = nowIso();

  await withTransaction(async (tx) => {
    for (const day of stored.days) {
      for (const metric of mapping) {
        const amount = day[metric.key];
        if (typeof amount !== "number" || amount <= 0) continue;
        const habit = bySlug.get(metric.slug);
        if (!habit) continue;
        const existing = await tx.query<{ id: string }>(
          "SELECT id FROM habit_entries WHERE user_id = ? AND habit_type_id = ? AND entry_date = ? LIMIT 1",
          [userId, habit.id, day.date],
        );
        if (existing.length > 0) {
          skipped += 1;
          continue;
        }
        await tx.execute(
          `INSERT INTO habit_entries
            (id, user_id, habit_type_id, entry_date, amount, note, source, import_id, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING`,
          [
            newId("hbe"),
            userId,
            habit.id,
            day.date,
            amount,
            "Apple Health",
            "import",
            id,
            now,
            now,
          ],
        );
        imported += 1;
        byMetric[metric.slug] = (byMetric[metric.slug] ?? 0) + 1;
      }
    }

    const summary = { ...stored.summary, imported, skipped };
    await tx.execute(
      "UPDATE apple_health_imports SET status = 'applied', payload = ?, summary = ?, applied_at = ? WHERE id = ? AND user_id = ?",
      ["[]", JSON.stringify(summary), now, id, userId],
    );
  });

  return { imported, skipped, byMetric };
}

export async function undoImport(
  userId: string,
  id: string,
): Promise<{ removed: number }> {
  const row = await queryOne<ImportRow>(
    "SELECT * FROM apple_health_imports WHERE id = ? AND user_id = ? LIMIT 1",
    [id, userId],
  );
  if (!row) throw new Error("Importação não encontrada.");
  if (row.status !== "applied") throw new Error("Esta importação não está aplicada.");

  let removed = 0;
  await withTransaction(async (tx) => {
    const result = await tx.execute(
      "DELETE FROM habit_entries WHERE user_id = ? AND import_id = ?",
      [userId, id],
    );
    removed = result.rowsAffected;
    await tx.execute(
      "UPDATE apple_health_imports SET status = 'undone', undone_at = ? WHERE id = ? AND user_id = ?",
      [nowIso(), id, userId],
    );
  });
  return { removed };
}
