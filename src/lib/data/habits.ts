import "server-only";
import { execute, newId, nowIso, query, queryOne } from "@/lib/db";
import { todayIso } from "@/lib/domain/dates";

export type HabitType = {
  id: string;
  slug: string;
  name: string;
  unit: string;
  icon: string;
  targetValue: number;
  direction: "at_least" | "at_most";
  active: boolean;
};

export type HabitEntry = {
  id: string;
  habitTypeId: string;
  habitSlug: string;
  habitName: string;
  unit: string;
  icon: string;
  entryDate: string;
  amount: number;
  note: string | null;
  source: string;
  createdAt: string;
};

export type Goal = {
  id: string;
  habitTypeId: string;
  habitName: string;
  unit: string;
  title: string;
  targetValue: number;
  period: "daily" | "weekly";
  startsOn: string;
  endsOn: string | null;
  status: "active" | "archived";
};

const DEFAULT_HABITS = [
  {
    slug: "agua",
    name: "Água",
    unit: "ml",
    icon: "drop",
    target: 2000,
    direction: "at_least",
  },
  {
    slug: "movimento",
    name: "Movimento",
    unit: "min",
    icon: "move",
    target: 30,
    direction: "at_least",
  },
  {
    slug: "sono",
    name: "Sono",
    unit: "h",
    icon: "moon",
    target: 7,
    direction: "at_least",
  },
] as const;

function mapType(row: Record<string, unknown>): HabitType {
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    unit: String(row.unit),
    icon: String(row.icon),
    targetValue: Number(row.target_value ?? 0),
    direction: row.direction === "at_most" ? "at_most" : "at_least",
    active: Number(row.active) === 1,
  };
}

export async function ensureDefaultHabits(userId: string): Promise<void> {
  const existing = await query<{ slug: string }>(
    "SELECT slug FROM habit_types WHERE user_id = ?",
    [userId],
  );
  const has = new Set(existing.map((row) => String(row.slug)));
  const createdAt = nowIso();
  for (const habit of DEFAULT_HABITS) {
    if (has.has(habit.slug)) continue;
    await execute(
      "INSERT INTO habit_types (id, user_id, slug, name, unit, icon, target_value, direction, active, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
      [
        newId("hab"),
        userId,
        habit.slug,
        habit.name,
        habit.unit,
        habit.icon,
        habit.target,
        habit.direction,
        1,
        createdAt,
      ],
    );
  }
}

export async function listHabitTypes(userId: string): Promise<HabitType[]> {
  const rows = await query<Record<string, unknown>>(
    "SELECT * FROM habit_types WHERE user_id = ? AND active = 1 ORDER BY created_at ASC",
    [userId],
  );
  return rows.map(mapType);
}

export async function getHabitType(
  userId: string,
  habitTypeId: string,
): Promise<HabitType | null> {
  const row = await queryOne<Record<string, unknown>>(
    "SELECT * FROM habit_types WHERE id = ? AND user_id = ? LIMIT 1",
    [habitTypeId, userId],
  );
  return row ? mapType(row) : null;
}

function mapEntry(row: Record<string, unknown>): HabitEntry {
  return {
    id: String(row.id),
    habitTypeId: String(row.habit_type_id),
    habitSlug: String(row.slug),
    habitName: String(row.name),
    unit: String(row.unit),
    icon: String(row.icon),
    entryDate: String(row.entry_date),
    amount: Number(row.amount ?? 0),
    note: row.note ? String(row.note) : null,
    source: String(row.source),
    createdAt: String(row.created_at),
  };
}

export async function listEntries(
  userId: string,
  start: string,
  end: string,
): Promise<HabitEntry[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT e.*, h.slug, h.name, h.unit, h.icon
       FROM habit_entries e
       JOIN habit_types h ON h.id = e.habit_type_id
      WHERE e.user_id = ? AND e.entry_date >= ? AND e.entry_date <= ?
      ORDER BY e.entry_date ASC, h.created_at ASC`,
    [userId, start, end],
  );
  return rows.map(mapEntry);
}

export async function listRecentEntries(
  userId: string,
  limit = 8,
): Promise<HabitEntry[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT e.*, h.slug, h.name, h.unit, h.icon
       FROM habit_entries e
       JOIN habit_types h ON h.id = e.habit_type_id
      WHERE e.user_id = ?
      ORDER BY e.entry_date DESC, e.created_at DESC
      LIMIT ?`,
    [userId, limit],
  );
  return rows.map(mapEntry);
}

export async function getEntry(
  userId: string,
  entryId: string,
): Promise<HabitEntry | null> {
  const row = await queryOne<Record<string, unknown>>(
    `SELECT e.*, h.slug, h.name, h.unit, h.icon
       FROM habit_entries e
       JOIN habit_types h ON h.id = e.habit_type_id
      WHERE e.id = ? AND e.user_id = ? LIMIT 1`,
    [entryId, userId],
  );
  return row ? mapEntry(row) : null;
}

export async function entriesForType(
  userId: string,
  habitTypeId: string,
  start: string,
  end: string,
): Promise<HabitEntry[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT e.*, h.slug, h.name, h.unit, h.icon
       FROM habit_entries e
       JOIN habit_types h ON h.id = e.habit_type_id
      WHERE e.user_id = ? AND e.habit_type_id = ? AND e.entry_date >= ? AND e.entry_date <= ?
      ORDER BY e.entry_date ASC`,
    [userId, habitTypeId, start, end],
  );
  return rows.map(mapEntry);
}

export async function entryDates(
  userId: string,
  habitTypeId?: string,
): Promise<string[]> {
  const rows = habitTypeId
    ? await query<{ entry_date: string }>(
        "SELECT entry_date FROM habit_entries WHERE user_id = ? AND habit_type_id = ? ORDER BY entry_date DESC",
        [userId, habitTypeId],
      )
    : await query<{ entry_date: string }>(
        "SELECT DISTINCT entry_date FROM habit_entries WHERE user_id = ? ORDER BY entry_date DESC",
        [userId],
      );
  return rows.map((row) => String(row.entry_date));
}

export async function countEntries(userId: string): Promise<number> {
  const rows = await query<{ total: unknown }>(
    "SELECT COUNT(*) AS total FROM habit_entries WHERE user_id = ?",
    [userId],
  );
  return Number(rows[0]?.total ?? 0);
}

export async function listGoals(userId: string): Promise<Goal[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT g.*, h.name AS habit_name, h.unit
       FROM personal_goals g
       JOIN habit_types h ON h.id = g.habit_type_id
      WHERE g.user_id = ? AND g.status = 'active'
      ORDER BY g.created_at DESC`,
    [userId],
  );
  return rows.map((row) => ({
    id: String(row.id),
    habitTypeId: String(row.habit_type_id),
    habitName: String(row.habit_name),
    unit: String(row.unit),
    title: String(row.title),
    targetValue: Number(row.target_value ?? 0),
    period: row.period === "weekly" ? "weekly" : "daily",
    startsOn: String(row.starts_on),
    endsOn: row.ends_on ? String(row.ends_on) : null,
    status: row.status === "archived" ? "archived" : "active",
  }));
}

export async function todayEntries(userId: string): Promise<HabitEntry[]> {
  const today = todayIso();
  return listEntries(userId, today, today);
}

export function goalReached(value: number, target: number): boolean {
  return target <= 0 ? value > 0 : value >= target;
}
