import "server-only";
import { query, queryOne, placeholders } from "@/lib/db";
import { POINTS } from "@/lib/domain/scoring";
import { awardPoints } from "@/lib/data/points";

export type Challenge = {
  id: string;
  communityId: string;
  communitySlug: string;
  communityName: string;
  title: string;
  description: string;
  kind: "individual" | "collective";
  metric: "habit_days" | "habit_value" | "points";
  habitSlug: string | null;
  targetValue: number;
  startsOn: string;
  endsOn: string;
  status: "active" | "ended";
  createdBy: string;
  createdAt: string;
  participantCount: number;
  joined: boolean;
};

export type ChallengeParticipant = {
  userId: string;
  name: string;
  avatarColor: string;
  joinedAt: string;
};

export type ChallengeProgress = {
  value: number;
  target: number;
  percent: number;
  complete: boolean;
  periodLabel: string;
};

function mapChallenge(row: Record<string, unknown>): Challenge {
  return {
    id: String(row.id),
    communityId: String(row.community_id),
    communitySlug: String(row.community_slug ?? ""),
    communityName: String(row.community_name ?? ""),
    title: String(row.title),
    description: String(row.description),
    kind: row.kind === "collective" ? "collective" : "individual",
    metric:
      row.metric === "habit_value"
        ? "habit_value"
        : row.metric === "points"
          ? "points"
          : "habit_days",
    habitSlug: row.habit_slug ? String(row.habit_slug) : null,
    targetValue: Number(row.target_value ?? 0),
    startsOn: String(row.starts_on),
    endsOn: String(row.ends_on),
    status: row.status === "ended" ? "ended" : "active",
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
    participantCount: Number(row.participant_count ?? 0),
    joined: Boolean(row.joined),
  };
}

const CHALLENGE_SELECT = `SELECT c.*, co.slug AS community_slug, co.name AS community_name
  FROM challenges c
  JOIN communities co ON co.id = c.community_id`;

export async function listChallenges(
  communityId: string,
  userId: string,
): Promise<Challenge[]> {
  const rows = await query<Record<string, unknown>>(
    `${CHALLENGE_SELECT} WHERE c.community_id = ? ORDER BY c.ends_on DESC, c.created_at DESC`,
    [communityId],
  );
  if (rows.length === 0) return [];
  const ids = rows.map((row) => String(row.id));
  const inSql = placeholders(ids.length);
  const participation = await query<{ challenge_id: string; user_id: string }>(
    `SELECT challenge_id, user_id FROM challenge_participants WHERE challenge_id IN (${inSql})`,
    ids,
  );
  const counts = new Map<string, number>();
  const joined = new Set<string>();
  for (const row of participation) {
    const id = String(row.challenge_id);
    counts.set(id, (counts.get(id) ?? 0) + 1);
    if (String(row.user_id) === userId) joined.add(id);
  }
  return rows.map((row) => {
    const id = String(row.id);
    return mapChallenge({
      ...row,
      participant_count: counts.get(id) ?? 0,
      joined: joined.has(id) ? 1 : 0,
    });
  });
}

export async function listChallengesForUser(
  userId: string,
): Promise<Challenge[]> {
  const rows = await query<{ community_id: string }>(
    "SELECT community_id FROM community_members WHERE user_id = ?",
    [userId],
  );
  const all: Challenge[] = [];
  for (const row of rows) {
    const challenges = await listChallenges(String(row.community_id), userId);
    all.push(...challenges);
  }
  return all.sort((a, b) => b.startsOn.localeCompare(a.startsOn));
}

export async function getChallenge(
  challengeId: string,
  userId: string,
): Promise<Challenge | null> {
  const row = await queryOne<Record<string, unknown>>(
    `${CHALLENGE_SELECT} WHERE c.id = ? LIMIT 1`,
    [challengeId],
  );
  if (!row) return null;
  const participant = await queryOne<{ total: unknown }>(
    "SELECT COUNT(*) AS total FROM challenge_participants WHERE challenge_id = ?",
    [challengeId],
  );
  const joined = await queryOne<{ total: unknown }>(
    "SELECT COUNT(*) AS total FROM challenge_participants WHERE challenge_id = ? AND user_id = ?",
    [challengeId, userId],
  );
  return mapChallenge({
    ...row,
    participant_count: participant?.total ?? 0,
    joined: Number(joined?.total ?? 0) > 0 ? 1 : 0,
  });
}

export async function listParticipants(
  challengeId: string,
): Promise<ChallengeParticipant[]> {
  const rows = await query<{
    user_id: string;
    name: string;
    avatar_color: string;
    joined_at: string;
  }>(
    `SELECT cp.user_id, u.name, u.avatar_color, cp.joined_at
       FROM challenge_participants cp
       JOIN users u ON u.id = cp.user_id
      WHERE cp.challenge_id = ?
      ORDER BY cp.joined_at ASC`,
    [challengeId],
  );
  return rows.map((row) => ({
    userId: String(row.user_id),
    name: String(row.name),
    avatarColor: String(row.avatar_color),
    joinedAt: String(row.joined_at),
  }));
}

async function participantValue(
  challenge: Challenge,
  userId: string,
): Promise<number> {
  if (challenge.metric === "points") {
    const rows = await query<{ total: unknown }>(
      "SELECT COALESCE(SUM(points),0) AS total FROM point_transactions WHERE user_id = ? AND created_at >= ? AND created_at <= ?",
      [
        userId,
        `${challenge.startsOn}T00:00:00.000Z`,
        `${challenge.endsOn}T23:59:59.999Z`,
      ],
    );
    return Number(rows[0]?.total ?? 0);
  }

  if (!challenge.habitSlug) return 0;

  if (challenge.metric === "habit_days") {
    const rows = await query<{ entry_date: string }>(
      `SELECT DISTINCT e.entry_date
         FROM habit_entries e
         JOIN habit_types h ON h.id = e.habit_type_id
        WHERE e.user_id = ? AND h.slug = ? AND e.entry_date >= ? AND e.entry_date <= ?`,
      [userId, challenge.habitSlug, challenge.startsOn, challenge.endsOn],
    );
    return rows.length;
  }

  const rows = await query<{ total: unknown }>(
    `SELECT COALESCE(SUM(e.amount),0) AS total
       FROM habit_entries e
       JOIN habit_types h ON h.id = e.habit_type_id
      WHERE e.user_id = ? AND h.slug = ? AND e.entry_date >= ? AND e.entry_date <= ?`,
    [userId, challenge.habitSlug, challenge.startsOn, challenge.endsOn],
  );
  return Number(rows[0]?.total ?? 0);
}

export async function computeProgress(
  challenge: Challenge,
  viewerId: string,
): Promise<ChallengeProgress> {
  let value = 0;
  if (challenge.kind === "collective") {
    const participants = await listParticipants(challenge.id);
    for (const participant of participants) {
      value += await participantValue(challenge, participant.userId);
    }
  } else {
    value = await participantValue(challenge, viewerId);
  }
  const target = challenge.targetValue;
  const percent = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
  return {
    value,
    target,
    percent,
    complete: target > 0 && value >= target,
    periodLabel: `${challenge.startsOn} a ${challenge.endsOn}`,
  };
}

/**
 * Concede pontos de desafio uma única vez por participante. O índice único de
 * point_transactions protege contra dupla premiação mesmo sob requisições
 * concorrentes.
 */
export async function evaluateChallengeAwards(
  challengeId: string,
): Promise<number> {
  const challenge = await getChallenge(challengeId, "system");
  if (!challenge) return 0;
  const participants = await listParticipants(challengeId);
  let awarded = 0;

  if (challenge.kind === "collective") {
    const progress = await computeProgress(challenge, participants[0]?.userId ?? "");
    if (!progress.complete) return 0;
    for (const participant of participants) {
      const created = await awardPoints({
        userId: participant.userId,
        kind: "challenge_collective",
        refType: "challenge",
        refId: challengeId,
        points: POINTS.challengeCollective,
      });
      if (created) awarded += 1;
    }
    return awarded;
  }

  for (const participant of participants) {
    const value = await participantValue(challenge, participant.userId);
    if (value < challenge.targetValue) continue;
    const created = await awardPoints({
      userId: participant.userId,
      kind: "challenge_individual",
      refType: "challenge",
      refId: challengeId,
      points: POINTS.challengeIndividual,
    });
    if (created) awarded += 1;
  }
  return awarded;
}

export async function countJoinedChallenges(userId: string): Promise<number> {
  const rows = await query<{ total: unknown }>(
    "SELECT COUNT(*) AS total FROM challenge_participants WHERE user_id = ?",
    [userId],
  );
  return Number(rows[0]?.total ?? 0);
}
