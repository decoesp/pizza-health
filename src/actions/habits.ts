"use server";

import "server-only";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  execute,
  newId,
  nowIso,
  query,
  queryOne,
  withTransaction,
} from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { addDays, daysBetween, startOfWeek, todayIso } from "@/lib/domain/dates";
import { goalReached } from "@/lib/data/habits";
import {
  awardGoal,
  awardHabitEntry,
  evaluateAchievements,
} from "@/lib/data/points";
import { recordAudit } from "@/lib/audit";
import { membershipFor } from "@/lib/authz";
import { formatAmount } from "@/lib/domain/habits";
import { getCommunityById } from "@/lib/data/communities";
import type { ActionState } from "@/lib/actions/types";

const amountSchema = z.coerce
  .number()
  .finite()
  .min(0, "O valor não pode ser negativo.")
  .max(100_000, "Valor acima do limite permitido.");

async function verifyHabit(userId: string, habitTypeId: string) {
  return queryOne<{ id: string; slug: string; name: string; unit: string }>(
    "SELECT id, slug, name, unit FROM habit_types WHERE id = ? AND user_id = ? AND active = 1 LIMIT 1",
    [habitTypeId, userId],
  );
}

async function evaluateGoals(
  userId: string,
  habitTypeId: string,
  date: string,
): Promise<void> {
  const goals = await query<{
    id: string;
    target_value: unknown;
    period: string;
  }>(
    "SELECT id, target_value, period FROM personal_goals WHERE user_id = ? AND habit_type_id = ? AND status = 'active'",
    [userId, habitTypeId],
  );
  const weekStart = startOfWeek(date);
  for (const goal of goals) {
    const start = goal.period === "weekly" ? weekStart : date;
    const end = goal.period === "weekly" ? addDays(weekStart, 6) : date;
    const rows = await query<{ total: unknown }>(
      "SELECT COALESCE(SUM(amount),0) AS total FROM habit_entries WHERE user_id = ? AND habit_type_id = ? AND entry_date >= ? AND entry_date <= ?",
      [userId, habitTypeId, start, end],
    );
    const total = Number(rows[0]?.total ?? 0);
    if (goalReached(total, Number(goal.target_value ?? 0))) {
      await awardGoal(userId, String(goal.id), start);
    }
  }
}

export async function saveHabitEntryAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/habitos");
  const habitTypeId = String(formData.get("habitTypeId") ?? "");
  const habit = await verifyHabit(user.id, habitTypeId);
  if (!habit) return { error: "Hábito não encontrado." };

  const dateRaw = String(formData.get("date") ?? todayIso());
  const date = dateRaw.slice(0, 10);
  const today = todayIso();
  if (date > today) return { error: "Não é possível registrar uma data futura." };
  if (daysBetween(date, today) > 365) {
    return { error: "O histórico aceita registros dos últimos 12 meses." };
  }
  const parsed = amountSchema.safeParse(formData.get("amount"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Informe um valor válido." };
  }
  if (parsed.data === 0) {
    return { error: "Informe um valor maior que zero." };
  }
  const noteRaw = String(formData.get("note") ?? "").trim();
  const note = noteRaw ? noteRaw.slice(0, 280) : null;
  const now = nowIso();

  const existing = await queryOne<{ id: string; created_at: string }>(
    "SELECT id, created_at FROM habit_entries WHERE user_id = ? AND habit_type_id = ? AND entry_date = ? LIMIT 1",
    [user.id, habitTypeId, date],
  );

  let entryId: string;
  let createdAt: string;
  let isNew = false;
  if (existing) {
    entryId = String(existing.id);
    createdAt = String(existing.created_at);
    await execute(
      "UPDATE habit_entries SET amount = ?, note = ?, updated_at = ? WHERE id = ? AND user_id = ?",
      [parsed.data, note, now, entryId, user.id],
    );
  } else {
    entryId = newId("hbe");
    createdAt = now;
    const result = await execute(
      "INSERT INTO habit_entries (id, user_id, habit_type_id, entry_date, amount, note, source, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING",
      [entryId, user.id, habitTypeId, date, parsed.data, note, "manual", now, now],
    );
    isNew = result.rowsAffected > 0;
    if (!isNew) {
      const row = await queryOne<{ id: string; created_at: string }>(
        "SELECT id, created_at FROM habit_entries WHERE user_id = ? AND habit_type_id = ? AND entry_date = ? LIMIT 1",
        [user.id, habitTypeId, date],
      );
      if (!row) return { error: "Não foi possível salvar o registro. Tente novamente." };
      entryId = String(row.id);
      createdAt = String(row.created_at);
      await execute(
        "UPDATE habit_entries SET amount = ?, note = ?, updated_at = ? WHERE id = ? AND user_id = ?",
        [parsed.data, note, now, entryId, user.id],
      );
    }
  }

  if (isNew) {
    await awardHabitEntry(user.id, String(habit.id), date, createdAt);
  }
  await evaluateGoals(user.id, habitTypeId, date);
  await evaluateAchievements(user.id);
  await recordAudit({
    actorId: user.id,
    action: isNew ? "habit.entry_create" : "habit.entry_update",
    entityType: "habit_entry",
    entityId: entryId,
    metadata: { date },
  });
  revalidatePath("/inicio");
  revalidatePath("/habitos");
  revalidatePath("/ranking");
  return {
    ok: true,
    message: isNew
      ? `${formatAmount(parsed.data, String(habit.unit))} de ${habit.name} registrado.`
      : "Registro atualizado.",
  };
}

export async function deleteHabitEntryAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/habitos");
  const entryId = String(formData.get("entryId") ?? "");
  const entry = await queryOne<{
    id: string;
    habit_type_id: string;
    entry_date: string;
  }>(
    "SELECT id, habit_type_id, entry_date FROM habit_entries WHERE id = ? AND user_id = ? LIMIT 1",
    [entryId, user.id],
  );
  if (!entry) return { error: "Registro não encontrado." };
  await withTransaction(async (tx) => {
    await tx.execute("DELETE FROM habit_entries WHERE id = ? AND user_id = ?", [
      entryId,
      user.id,
    ]);
    await tx.execute(
      "DELETE FROM point_transactions WHERE user_id = ? AND kind = 'habit' AND ref_type = 'habit_entry' AND ref_id = ?",
      [user.id, `${entry.habit_type_id}:${entry.entry_date}`],
    );
  });
  await recordAudit({
    actorId: user.id,
    action: "habit.entry_delete",
    entityType: "habit_entry",
    entityId: entryId,
    metadata: { date: String(entry.entry_date) },
  });
  revalidatePath("/inicio");
  revalidatePath("/habitos");
  revalidatePath("/ranking");
  return { ok: true, message: "Registro removido." };
}

export async function createGoalAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/habitos");
  const habitTypeId = String(formData.get("habitTypeId") ?? "");
  const habit = await verifyHabit(user.id, habitTypeId);
  if (!habit) return { error: "Escolha um hábito válido." };
  const parsed = z
    .object({
      title: z.string().trim().min(2).max(80),
      target: amountSchema,
      period: z.enum(["daily", "weekly"]),
    })
    .safeParse({
      title: formData.get("title"),
      target: formData.get("target"),
      period: formData.get("period") ?? "daily",
    });
  if (!parsed.success) return { error: "Confira o título e a meta." };
  if (parsed.data.target <= 0) return { error: "A meta precisa ser maior que zero." };
  await execute(
    "INSERT INTO personal_goals (id, user_id, habit_type_id, title, target_value, period, starts_on, ends_on, status, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
    [
      newId("goal"),
      user.id,
      habitTypeId,
      parsed.data.title,
      parsed.data.target,
      parsed.data.period,
      todayIso(),
      null,
      "active",
      nowIso(),
    ],
  );
  await recordAudit({
    actorId: user.id,
    action: "goal.create",
    entityType: "personal_goal",
    metadata: { period: parsed.data.period },
  });
  revalidatePath("/habitos");
  revalidatePath("/inicio");
  return { ok: true, message: "Meta criada." };
}

export async function archiveGoalAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/habitos");
  const goalId = String(formData.get("goalId") ?? "");
  const goal = await queryOne<{ id: string }>(
    "SELECT id FROM personal_goals WHERE id = ? AND user_id = ? LIMIT 1",
    [goalId, user.id],
  );
  if (!goal) return { error: "Meta não encontrada." };
  await execute(
    "UPDATE personal_goals SET status = 'archived' WHERE id = ? AND user_id = ?",
    [goalId, user.id],
  );
  revalidatePath("/habitos");
  revalidatePath("/inicio");
  return { ok: true, message: "Meta arquivada." };
}

export async function createHabitTypeAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/habitos");
  const parsed = z
    .object({
      name: z.string().trim().min(2).max(40),
      unit: z.string().trim().min(1).max(12),
      target: amountSchema,
    })
    .safeParse({
      name: formData.get("name"),
      unit: formData.get("unit"),
      target: formData.get("target"),
    });
  if (!parsed.success) return { error: "Confira o nome, a unidade e a meta." };
  if (parsed.data.target <= 0) return { error: "A meta precisa ser maior que zero." };
  const slug = parsed.data.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
  const existing = await queryOne<{ id: string }>(
    "SELECT id FROM habit_types WHERE user_id = ? AND slug = ? LIMIT 1",
    [user.id, slug],
  );
  if (existing) return { error: "Você já tem um hábito com esse nome." };
  await execute(
    "INSERT INTO habit_types (id, user_id, slug, name, unit, icon, target_value, direction, active, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
    [
      newId("hab"),
      user.id,
      slug,
      parsed.data.name,
      parsed.data.unit,
      "spark",
      parsed.data.target,
      "at_least",
      1,
      nowIso(),
    ],
  );
  revalidatePath("/habitos");
  return { ok: true, message: "Hábito criado." };
}

export async function shareHabitAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/habitos");
  const communityId = String(formData.get("communityId") ?? "");
  const entryId = String(formData.get("entryId") ?? "");
  const membership = await membershipFor(user.id, communityId);
  if (!membership) return { error: "Você não participa desta comunidade." };
  const entry = await queryOne<{
    id: string;
    amount: unknown;
    entry_date: string;
    name: string;
    unit: string;
  }>(
    `SELECT e.id, e.amount, e.entry_date, h.name, h.unit
       FROM habit_entries e JOIN habit_types h ON h.id = e.habit_type_id
      WHERE e.id = ? AND e.user_id = ? LIMIT 1`,
    [entryId, user.id],
  );
  if (!entry) return { error: "Registro não encontrado." };
  const duplicate = await queryOne<{ id: string }>(
    "SELECT id FROM posts WHERE user_id = ? AND kind = 'habit' AND ref_id = ? AND deleted_at IS NULL LIMIT 1",
    [user.id, entryId],
  );
  if (duplicate) return { error: "Você já compartilhou este registro." };
  const extra = String(formData.get("note") ?? "").trim().slice(0, 280);
  const body = `Registrei ${formatAmount(Number(entry.amount), String(entry.unit))} de ${entry.name}.${extra ? ` ${extra}` : ""}`;
  const postId = newId("post");
  const now = nowIso();
  await execute(
    "INSERT INTO posts (id, community_id, user_id, body, kind, ref_id, visibility, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
    [postId, communityId, user.id, body, "habit", entryId, "community", now, now],
  );
  await recordAudit({
    actorId: user.id,
    action: "post.create_habit_share",
    entityType: "post",
    entityId: postId,
    communityId,
  });
  const community = await getCommunityById(communityId);
  revalidatePath(`/comunidade/${community?.slug ?? ""}`);
  revalidatePath("/inicio");
  return { ok: true, message: "Registro compartilhado no feed." };
}
