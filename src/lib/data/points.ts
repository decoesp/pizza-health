import "server-only";
import { execute, newId, nowIso, query } from "@/lib/db";
import {
  ACHIEVEMENTS,
  POINTS,
  sortRanking,
  type AchievementCode,
  type RankRow,
} from "@/lib/domain/scoring";
import { currentStreak, todayIso } from "@/lib/domain/dates";
import { notify } from "@/lib/notifications";

export type AwardInput = {
  userId: string;
  kind: string;
  refType: string;
  refId: string;
  points: number;
  createdAt?: string;
};

export async function awardPoints(input: AwardInput): Promise<boolean> {
  const result = await execute(
    "INSERT INTO point_transactions (id, user_id, kind, ref_type, ref_id, points, created_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT DO NOTHING",
    [
      newId("pts"),
      input.userId,
      input.kind,
      input.refType,
      input.refId,
      input.points,
      input.createdAt ?? nowIso(),
    ],
  );
  return result.rowsAffected > 0;
}

const saoPauloDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export async function socialPointsToday(userId: string): Promise<number> {
  const rows = await query<{ points: unknown; created_at: string }>(
    "SELECT points, created_at FROM point_transactions WHERE user_id = ? AND kind IN ('comment','reaction')",
    [userId],
  );
  const today = todayIso();
  return rows
    .filter((row) => {
      const date = new Date(String(row.created_at));
      return !Number.isNaN(date.getTime()) && saoPauloDay.format(date) === today;
    })
    .reduce((total, row) => total + Number(row.points ?? 0), 0);
}

export async function awardSocial(
  userId: string,
  kind: "comment" | "reaction",
  refType: string,
  refId: string,
): Promise<void> {
  const used = await socialPointsToday(userId);
  if (used >= POINTS.socialDailyCap) return;
  const requested = kind === "comment" ? POINTS.comment : POINTS.reaction;
  const points = Math.min(requested, POINTS.socialDailyCap - used);
  if (points <= 0) return;
  await awardPoints({ userId, kind, refType, refId, points });
}

export async function pointsTotal(userId: string): Promise<number> {
  const rows = await query<{ total: unknown }>(
    "SELECT COALESCE(SUM(points),0) AS total FROM point_transactions WHERE user_id = ?",
    [userId],
  );
  return Number(rows[0]?.total ?? 0);
}

export async function pointsSince(userId: string, start: string): Promise<number> {
  const rows = await query<{ total: unknown }>(
    "SELECT COALESCE(SUM(points),0) AS total FROM point_transactions WHERE user_id = ? AND created_at >= ?",
    [userId, `${start}T00:00:00.000Z`],
  );
  return Number(rows[0]?.total ?? 0);
}

export type DayPoints = { day: string; points: number };

export async function pointsByDay(
  userId: string,
  start: string,
  end: string,
): Promise<DayPoints[]> {
  const rows = await query<{ created_at: string; points: unknown }>(
    "SELECT created_at, points FROM point_transactions WHERE user_id = ? AND created_at >= ? AND created_at <= ?",
    [userId, `${start}T00:00:00.000Z`, `${end}T23:59:59.999Z`],
  );
  const map = new Map<string, number>();
  for (const row of rows) {
    const day = String(row.created_at).slice(0, 10);
    map.set(day, (map.get(day) ?? 0) + Number(row.points ?? 0));
  }
  return [...map.entries()]
    .map(([day, points]) => ({ day, points }))
    .sort((a, b) => a.day.localeCompare(b.day));
}

export type RankingRow = RankRow & { privacyRank: boolean };

export async function communityRanking(
  communityId: string,
  start: string,
): Promise<RankingRow[]> {
  const rows = await query<{
    id: string;
    name: string;
    avatar_color: string;
    privacy_rank: unknown;
    points: unknown;
    entries: unknown;
  }>(
    `SELECT u.id, u.name, u.avatar_color, u.privacy_rank,
            COALESCE(SUM(p.points),0) AS points,
            COUNT(p.id) AS entries
       FROM community_members m
       JOIN users u ON u.id = m.user_id
       LEFT JOIN point_transactions p ON p.user_id = u.id AND p.created_at >= ?
      WHERE m.community_id = ? AND u.deleted_at IS NULL
      GROUP BY u.id, u.name, u.avatar_color, u.privacy_rank`,
    [`${start}T00:00:00.000Z`, communityId],
  );
  const mapped: RankingRow[] = rows.map((row) => ({
    userId: String(row.id),
    name: String(row.name),
    avatarColor: String(row.avatar_color),
    points: Number(row.points ?? 0),
    entries: Number(row.entries ?? 0),
    privacyRank: Number(row.privacy_rank) === 1,
  }));
  const visible = sortRanking(mapped.filter((row) => row.privacyRank));
  return visible;
}

export async function viewerRankingPosition(
  communityId: string,
  userId: string,
  start: string,
): Promise<{ points: number; position: number | null; total: number }> {
  const visible = await communityRanking(communityId, start);
  const index = visible.findIndex((row) => row.userId === userId);
  return {
    points: index >= 0 ? visible[index]?.points ?? 0 : 0,
    position: index >= 0 ? index + 1 : null,
    total: visible.length,
  };
}

export type Achievement = {
  code: string;
  title: string;
  description: string;
  earnedAt: string;
};

export async function listAchievements(userId: string): Promise<Achievement[]> {
  const rows = await query<{
    code: string;
    title: string;
    description: string;
    earned_at: string;
  }>(
    "SELECT code, title, description, earned_at FROM achievements WHERE user_id = ? ORDER BY earned_at DESC",
    [userId],
  );
  return rows.map((row) => ({
    code: String(row.code),
    title: String(row.title),
    description: String(row.description),
    earnedAt: String(row.earned_at),
  }));
}

export async function grantAchievement(
  userId: string,
  code: AchievementCode,
  earnedAt = nowIso(),
): Promise<boolean> {
  const definition = ACHIEVEMENTS[code];
  const result = await execute(
    "INSERT INTO achievements (id, user_id, code, title, description, earned_at) VALUES (?,?,?,?,?,?) ON CONFLICT DO NOTHING",
    [newId("ach"), userId, code, definition.title, definition.description, earnedAt],
  );
  if (result.rowsAffected > 0) {
    await notify({
      userId,
      kind: "achievement",
      title: `Conquista: ${definition.title}`,
      body: definition.description,
      href: "/perfil/conquistas",
    });
    return true;
  }
  return false;
}

async function countRows(
  sql: string,
  params: (string | number | null)[],
): Promise<number> {
  const rows = await query<{ total: unknown }>(sql, params);
  return Number(rows[0]?.total ?? 0);
}

/**
 * Avalia conquistas a partir de fatos já registrados. É idempotente: o índice
 * único (user_id, code) impede duplicação e concede pontos apenas uma vez.
 */
export async function evaluateAchievements(userId: string): Promise<void> {
  const entries = await countRows(
    "SELECT COUNT(*) AS total FROM habit_entries WHERE user_id = ?",
    [userId],
  );
  if (entries >= 1) await grantAchievement(userId, "primeiro_registro");
  if (entries >= 30) await grantAchievement(userId, "constancia_30");

  const types = await query<{ id: string; slug: string }>(
    "SELECT id, slug FROM habit_types WHERE user_id = ?",
    [userId],
  );
  let anySeven = false;
  let waterSeven = false;
  for (const type of types) {
    const rows = await query<{ entry_date: string }>(
      "SELECT entry_date FROM habit_entries WHERE user_id = ? AND habit_type_id = ? ORDER BY entry_date DESC",
      [userId, String(type.id)],
    );
    const streak = currentStreak(rows.map((row) => String(row.entry_date)));
    if (streak >= 7) {
      anySeven = true;
      if (String(type.slug) === "agua") waterSeven = true;
    }
  }
  if (anySeven) await grantAchievement(userId, "sequencia_7");
  if (waterSeven) await grantAchievement(userId, "hidratacao_7");

  const documents = await countRows(
    "SELECT COUNT(*) AS total FROM health_documents WHERE user_id = ? AND deleted_at IS NULL",
    [userId],
  );
  if (documents >= 1) await grantAchievement(userId, "primeiro_documento");

  const vaccines = await countRows(
    "SELECT COUNT(*) AS total FROM vaccine_records WHERE user_id = ? AND status = 'confirmed'",
    [userId],
  );
  if (vaccines >= 1) await grantAchievement(userId, "vacinas_em_dia");

  const challenges = await countRows(
    "SELECT COUNT(*) AS total FROM challenge_participants WHERE user_id = ?",
    [userId],
  );
  if (challenges >= 1) await grantAchievement(userId, "primeiro_desafio");

  const comments = await countRows(
    "SELECT COUNT(*) AS total FROM comments WHERE user_id = ? AND deleted_at IS NULL",
    [userId],
  );
  if (comments >= 5) await grantAchievement(userId, "apoio_5");
}

export async function awardHabitEntry(
  userId: string,
  habitTypeId: string,
  entryDate: string,
  createdAt: string,
): Promise<void> {
  await awardPoints({
    userId,
    kind: "habit",
    refType: "habit_entry",
    refId: `${habitTypeId}:${entryDate}`,
    points: POINTS.habitEntry,
    createdAt,
  });
}

export async function awardGoal(
  userId: string,
  goalId: string,
  date: string,
  points = POINTS.goalDaily,
): Promise<void> {
  await awardPoints({
    userId,
    kind: "goal",
    refType: "personal_goal",
    refId: `${goalId}:${date}`,
    points,
    createdAt: nowIso(),
  });
}
