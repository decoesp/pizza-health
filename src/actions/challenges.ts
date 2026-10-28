"use server";

import "server-only";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { execute, newId, nowIso, query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { isManager, membershipFor } from "@/lib/authz";
import { getCommunityById } from "@/lib/data/communities";
import { evaluateChallengeAwards } from "@/lib/data/challenges";
import { evaluateAchievements } from "@/lib/data/points";
import { notify } from "@/lib/notifications";
import { recordAudit } from "@/lib/audit";
import { daysBetween, todayIso } from "@/lib/domain/dates";
import type { ActionState } from "@/lib/actions/types";

const dateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use uma data válida.");

export async function createChallengeAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/desafios");
  const communityId = String(formData.get("communityId") ?? "");
  const membership = await membershipFor(user.id, communityId);
  if (!membership || !isManager(membership.role)) {
    return { error: "Apenas administradores da comunidade podem criar desafios." };
  }
  const parsed = z
    .object({
      title: z.string().trim().min(3, "Dê um título ao desafio.").max(100),
      description: z.string().trim().max(600).optional(),
      kind: z.enum(["individual", "collective"]),
      metric: z.enum(["habit_days", "habit_value", "points"]),
      habitSlug: z.string().trim().max(40).optional(),
      target: z.coerce.number().finite().positive("A meta precisa ser maior que zero.").max(100_000),
      startsOn: dateSchema,
      endsOn: dateSchema,
    })
    .safeParse({
      title: formData.get("title"),
      description: formData.get("description") || undefined,
      kind: formData.get("kind") ?? "individual",
      metric: formData.get("metric") ?? "habit_days",
      habitSlug: formData.get("habitSlug") || undefined,
      target: formData.get("target"),
      startsOn: formData.get("startsOn"),
      endsOn: formData.get("endsOn"),
    });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  if (parsed.data.endsOn < parsed.data.startsOn) {
    return { error: "A data final precisa ser depois do início." };
  }
  if (daysBetween(parsed.data.startsOn, parsed.data.endsOn) > 90) {
    return { error: "Desafios podem durar no máximo 90 dias." };
  }
  if (parsed.data.metric !== "points" && !parsed.data.habitSlug) {
    return { error: "Escolha o hábito que será acompanhado." };
  }
  if (parsed.data.metric !== "points" && !["agua", "movimento", "sono"].includes(parsed.data.habitSlug ?? "")) {
    const custom = await queryOne<{ id: string }>(
      "SELECT id FROM habit_types WHERE user_id = ? AND slug = ? LIMIT 1",
      [user.id, parsed.data.habitSlug ?? null],
    );
    if (!custom) return { error: "Hábito inválido para o desafio." };
  }

  const challengeId = newId("chg");
  const now = nowIso();
  await execute(
    `INSERT INTO challenges (id, community_id, title, description, kind, metric, habit_slug, target_value, starts_on, ends_on, created_by, created_at, status)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      challengeId,
      communityId,
      parsed.data.title,
      parsed.data.description ?? "",
      parsed.data.kind,
      parsed.data.metric,
      parsed.data.metric === "points" ? null : parsed.data.habitSlug ?? null,
      parsed.data.target,
      parsed.data.startsOn,
      parsed.data.endsOn,
      user.id,
      now,
      "active",
    ],
  );
  const members = await query<{ user_id: string }>(
    "SELECT user_id FROM community_members WHERE community_id = ? AND user_id != ?",
    [communityId, user.id],
  );
  for (const member of members) {
    await notify({
      userId: String(member.user_id),
      actorId: user.id,
      kind: "challenge",
      title: "Novo desafio na comunidade",
      body: parsed.data.title,
      href: `/desafios/${challengeId}`,
    });
  }
  await recordAudit({
    actorId: user.id,
    action: "challenge.create",
    entityType: "challenge",
    entityId: challengeId,
    communityId,
    metadata: { kind: parsed.data.kind, metric: parsed.data.metric },
  });
  const community = await getCommunityById(communityId);
  revalidatePath("/desafios");
  revalidatePath(`/comunidade/${community?.slug ?? ""}`);
  return {
    ok: true,
    message: "Desafio criado.",
    link: `/desafios/${challengeId}`,
    linkLabel: "Abrir desafio",
  };
}

export async function joinChallengeAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/desafios");
  const challengeId = String(formData.get("challengeId") ?? "");
  const challenge = await queryOne<{ id: string; community_id: string; created_by: string; title: string }>(
    "SELECT id, community_id, created_by, title FROM challenges WHERE id = ? LIMIT 1",
    [challengeId],
  );
  if (!challenge) return { error: "Desafio não encontrado." };
  const membership = await membershipFor(user.id, String(challenge.community_id));
  if (!membership) return { error: "Você não participa desta comunidade." };
  const inserted = await execute(
    "INSERT INTO challenge_participants (id, challenge_id, user_id, joined_at) VALUES (?,?,?,?) ON CONFLICT DO NOTHING",
    [newId("cp"), challengeId, user.id, nowIso()],
  );
  if (inserted.rowsAffected === 0) return { error: "Você já participa deste desafio." };
  await evaluateChallengeAwards(challengeId);
  await evaluateAchievements(user.id);
  await notify({
    userId: String(challenge.created_by),
    actorId: user.id,
    kind: "challenge",
    title: `${user.name} entrou no desafio`,
    body: String(challenge.title),
    href: `/desafios/${challengeId}`,
  });
  await recordAudit({
    actorId: user.id,
    action: "challenge.join",
    entityType: "challenge",
    entityId: challengeId,
    communityId: String(challenge.community_id),
  });
  revalidatePath("/desafios");
  revalidatePath(`/desafios/${challengeId}`);
  return { ok: true, message: "Você entrou no desafio." };
}

export async function leaveChallengeAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/desafios");
  const challengeId = String(formData.get("challengeId") ?? "");
  const removed = await execute(
    "DELETE FROM challenge_participants WHERE challenge_id = ? AND user_id = ?",
    [challengeId, user.id],
  );
  if (removed.rowsAffected === 0) return { error: "Você não participa deste desafio." };
  await recordAudit({
    actorId: user.id,
    action: "challenge.leave",
    entityType: "challenge",
    entityId: challengeId,
  });
  revalidatePath("/desafios");
  revalidatePath(`/desafios/${challengeId}`);
  return { ok: true, message: "Você saiu do desafio." };
}

export async function endChallengeAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/desafios");
  const challengeId = String(formData.get("challengeId") ?? "");
  const challenge = await queryOne<{ community_id: string; ends_on: string }>(
    "SELECT community_id, ends_on FROM challenges WHERE id = ? LIMIT 1",
    [challengeId],
  );
  if (!challenge) return { error: "Desafio não encontrado." };
  const membership = await membershipFor(user.id, String(challenge.community_id));
  if (!membership || !isManager(membership.role)) {
    return { error: "Apenas administradores podem encerrar desafios." };
  }
  if (String(challenge.ends_on) > todayIso()) {
    return { error: "O desafio ainda está dentro do período. Encerre apenas após a data final." };
  }
  await evaluateChallengeAwards(challengeId);
  await execute("UPDATE challenges SET status = 'ended' WHERE id = ?", [challengeId]);
  revalidatePath(`/desafios/${challengeId}`);
  return { ok: true, message: "Desafio encerrado e pontos avaliados." };
}
