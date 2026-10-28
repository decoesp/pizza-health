"use server";

import "server-only";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  execute,
  newId,
  nowIso,
  queryOne,
  withTransaction,
} from "@/lib/db";
import { requireUser, destroySession } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";
import { membershipFor } from "@/lib/authz";
import { recordAudit } from "@/lib/audit";
import type { ActionState } from "@/lib/actions/types";

const COLORS = ["#C2410C", "#3F6B4F", "#8A5A0F", "#4C6FA8", "#8A5A8F", "#B23E1F", "#4F6B62"];

export async function updateProfileAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/perfil");
  const parsed = z
    .object({
      name: z.string().trim().min(2, "Informe pelo menos 2 caracteres.").max(80),
      bio: z.string().trim().max(280).optional(),
      city: z.string().trim().max(80).optional(),
      color: z.string().trim(),
    })
    .safeParse({
      name: formData.get("name"),
      bio: formData.get("bio") || undefined,
      city: formData.get("city") || undefined,
      color: formData.get("color") ?? "#C2410C",
    });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const color = COLORS.includes(parsed.data.color) ? parsed.data.color : "#C2410C";
  await execute(
    "UPDATE users SET name = ?, bio = ?, city = ?, avatar_color = ?, updated_at = ? WHERE id = ?",
    [parsed.data.name, parsed.data.bio ?? null, parsed.data.city ?? null, color, nowIso(), user.id],
  );
  await recordAudit({
    actorId: user.id,
    action: "profile.update",
    entityType: "user",
    entityId: user.id,
  });
  revalidatePath("/perfil");
  revalidatePath("/inicio");
  return { ok: true, message: "Perfil atualizado." };
}

export async function updatePrivacyAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/perfil/privacidade");
  const flags = {
    privacy_rank: formData.get("ranking") ? 1 : 0,
    privacy_profile: formData.get("profile") ? 1 : 0,
    notify_comments: formData.get("notifyComments") ? 1 : 0,
    notify_reactions: formData.get("notifyReactions") ? 1 : 0,
    notify_challenges: formData.get("notifyChallenges") ? 1 : 0,
    notify_reminders: formData.get("notifyReminders") ? 1 : 0,
  };
  await execute(
    `UPDATE users SET privacy_rank = ?, privacy_profile = ?, notify_comments = ?, notify_reactions = ?,
       notify_challenges = ?, notify_reminders = ?, updated_at = ? WHERE id = ?`,
    [
      flags.privacy_rank,
      flags.privacy_profile,
      flags.notify_comments,
      flags.notify_reactions,
      flags.notify_challenges,
      flags.notify_reminders,
      nowIso(),
      user.id,
    ],
  );
  await recordAudit({
    actorId: user.id,
    action: "profile.privacy_update",
    entityType: "user",
    entityId: user.id,
  });
  revalidatePath("/perfil/privacidade");
  revalidatePath("/ranking");
  revalidatePath("/inicio");
  return { ok: true, message: "Preferências atualizadas." };
}

export async function setRankingVisibilityAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/ranking");
  const visible = formData.get("visible") ? 1 : 0;
  await execute("UPDATE users SET privacy_rank = ?, updated_at = ? WHERE id = ?", [
    visible,
    nowIso(),
    user.id,
  ]);
  await recordAudit({
    actorId: user.id,
    action: "profile.ranking_visibility",
    entityType: "user",
    entityId: user.id,
    metadata: { visible: visible === 1 },
  });
  revalidatePath("/ranking");
  revalidatePath("/inicio");
  return {
    ok: true,
    message: visible ? "Você aparece no ranking da comunidade." : "Você saiu do ranking.",
  };
}

export async function updateSharingAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/perfil/privacidade");
  const communityId = String(formData.get("communityId") ?? "");
  const category = String(formData.get("category") ?? "");
  if (!["profile", "habits", "vaccines", "exams"].includes(category)) {
    return { error: "Categoria inválida." };
  }
  const membership = await membershipFor(user.id, communityId);
  if (!membership) return { error: "Você não participa desta comunidade." };
  const shared = formData.get("shared") ? 1 : 0;
  const existing = await queryOne<{ id: string }>(
    "SELECT id FROM sharing_preferences WHERE user_id = ? AND community_id = ? AND category = ? LIMIT 1",
    [user.id, communityId, category],
  );
  if (existing) {
    await execute("UPDATE sharing_preferences SET shared = ?, updated_at = ? WHERE id = ?", [
      shared,
      nowIso(),
      String(existing.id),
    ]);
  } else {
    await execute(
      "INSERT INTO sharing_preferences (id, user_id, community_id, category, shared, updated_at) VALUES (?,?,?,?,?,?)",
      [newId("shr"), user.id, communityId, category, shared, nowIso()],
    );
  }
  await recordAudit({
    actorId: user.id,
    action: "profile.sharing_update",
    entityType: "sharing_preference",
    entityId: communityId,
    communityId,
    metadata: { category, shared: shared === 1 },
  });
  revalidatePath("/perfil/privacidade");
  return { ok: true, message: "Compartilhamento atualizado." };
}

export async function updateCommunitySharingAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/perfil/privacidade");
  const communityId = String(formData.get("communityId") ?? "");
  const membership = await membershipFor(user.id, communityId);
  if (!membership) return { error: "Você não participa desta comunidade." };
  const categories = ["profile", "habits", "vaccines", "exams"] as const;
  const now = nowIso();
  for (const category of categories) {
    const shared = formData.get(category) ? 1 : 0;
    const existing = await queryOne<{ id: string }>(
      "SELECT id FROM sharing_preferences WHERE user_id = ? AND community_id = ? AND category = ? LIMIT 1",
      [user.id, communityId, category],
    );
    if (existing) {
      await execute("UPDATE sharing_preferences SET shared = ?, updated_at = ? WHERE id = ?", [
        shared,
        now,
        String(existing.id),
      ]);
    } else {
      await execute(
        "INSERT INTO sharing_preferences (id, user_id, community_id, category, shared, updated_at) VALUES (?,?,?,?,?,?)",
        [newId("shr"), user.id, communityId, category, shared, now],
      );
    }
  }
  await recordAudit({
    actorId: user.id,
    action: "profile.sharing_bulk_update",
    entityType: "sharing_preference",
    entityId: communityId,
    communityId,
  });
  revalidatePath("/perfil/privacidade");
  return { ok: true, message: "Compartilhamento da comunidade atualizado." };
}

export async function requestExportAction(): Promise<ActionState> {
  const user = await requireUser("/perfil/dados");
  await execute(
    "INSERT INTO data_requests (id, user_id, kind, status, notes, created_at, processed_at) VALUES (?,?,?,?,?,?,?)",
    [newId("req"), user.id, "export", "completed", "Exportação imediata em JSON.", nowIso(), nowIso()],
  );
  await recordAudit({
    actorId: user.id,
    action: "data.export",
    entityType: "user",
    entityId: user.id,
  });
  return {
    ok: true,
    message: "Exportação pronta. O arquivo é gerado na hora, com os dados da sua conta.",
    link: "/api/export",
    linkLabel: "Baixar exportação JSON",
  };
}

export async function requestDeletionAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/perfil/dados");
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "").trim();
  if (confirmation !== "EXCLUIR") {
    return { error: "Digite EXCLUIR para confirmar a remoção definitiva." };
  }
  const row = await queryOne<{ password_hash: string }>(
    "SELECT password_hash FROM users WHERE id = ? LIMIT 1",
    [user.id],
  );
  if (!row || !(await verifyPassword(password, String(row.password_hash)))) {
    return { error: "Senha incorreta." };
  }

  const now = nowIso();
  await withTransaction(async (tx) => {
    const owned = await tx.query<{ community_id: string }>(
      "SELECT community_id FROM community_members WHERE user_id = ? AND role = 'owner'",
      [user.id],
    );
    for (const community of owned) {
      const communityId = String(community.community_id);
      const other = await tx.query<{ user_id: string; role: string }>(
        "SELECT user_id, role FROM community_members WHERE community_id = ? AND user_id != ? ORDER BY joined_at ASC LIMIT 1",
        [communityId, user.id],
      );
      if (other[0]) {
        const nextOwner = String(other[0].user_id);
        await tx.execute(
          "UPDATE community_members SET role = 'owner' WHERE community_id = ? AND user_id = ?",
          [communityId, nextOwner],
        );
        await tx.execute("UPDATE communities SET created_by = ?, updated_at = ? WHERE id = ?", [
          nextOwner,
          now,
          communityId,
        ]);
        await tx.execute(
          "UPDATE community_members SET role = 'member' WHERE community_id = ? AND user_id = ? AND role = 'owner'",
          [communityId, user.id],
        );
      } else {
        await tx.execute("UPDATE communities SET archived_at = ?, updated_at = ? WHERE id = ?", [
          now,
          now,
          communityId,
        ]);
        await tx.execute("DELETE FROM sharing_preferences WHERE community_id = ?", [communityId]);
        await tx.execute("DELETE FROM community_members WHERE community_id = ?", [communityId]);
      }
    }

    const documents = await tx.query<{ id: string }>(
      "SELECT id FROM health_documents WHERE user_id = ?",
      [user.id],
    );
    for (const doc of documents) {
      const documentId = String(doc.id);
      await tx.execute("UPDATE laboratory_exams SET document_id = NULL WHERE document_id = ?", [documentId]);
      await tx.execute("UPDATE vaccine_records SET document_id = NULL WHERE document_id = ?", [documentId]);
      await tx.execute("DELETE FROM document_shares WHERE document_id = ?", [documentId]);
      await tx.execute("DELETE FROM document_blobs WHERE document_id = ?", [documentId]);
      await tx.execute("DELETE FROM health_documents WHERE id = ?", [documentId]);
    }
    await tx.execute("DELETE FROM document_shares WHERE shared_by = ?", [user.id]);
    await tx.execute("DELETE FROM exam_results WHERE user_id = ?", [user.id]);
    await tx.execute("DELETE FROM laboratory_exams WHERE user_id = ?", [user.id]);
    await tx.execute("DELETE FROM vaccine_records WHERE user_id = ?", [user.id]);
    await tx.execute("DELETE FROM personal_goals WHERE user_id = ?", [user.id]);
    await tx.execute("DELETE FROM habit_entries WHERE user_id = ?", [user.id]);
    await tx.execute("DELETE FROM habit_types WHERE user_id = ?", [user.id]);
    await tx.execute("DELETE FROM challenge_participants WHERE user_id = ?", [user.id]);
    const createdChallenges = await tx.query<{ id: string }>(
      "SELECT id FROM challenges WHERE created_by = ?",
      [user.id],
    );
    for (const challenge of createdChallenges) {
      await tx.execute("DELETE FROM challenge_participants WHERE challenge_id = ?", [String(challenge.id)]);
      await tx.execute("DELETE FROM challenges WHERE id = ?", [String(challenge.id)]);
    }
    await tx.execute("DELETE FROM comments WHERE user_id = ?", [user.id]);
    await tx.execute("DELETE FROM reactions WHERE user_id = ?", [user.id]);
    await tx.execute("DELETE FROM content_reports WHERE reporter_id = ?", [user.id]);
    const reportedPosts = await tx.query<{ post_id: string }>(
      "SELECT post_id FROM content_reports WHERE post_id IN (SELECT id FROM posts WHERE user_id = ?)",
      [user.id],
    );
    for (const report of reportedPosts) {
      await tx.execute("DELETE FROM content_reports WHERE post_id = ?", [String(report.post_id)]);
    }
    await tx.execute("DELETE FROM posts WHERE user_id = ?", [user.id]);
    await tx.execute("DELETE FROM achievements WHERE user_id = ?", [user.id]);
    await tx.execute("DELETE FROM point_transactions WHERE user_id = ?", [user.id]);
    await tx.execute("DELETE FROM notifications WHERE user_id = ?", [user.id]);
    await tx.execute("UPDATE notifications SET actor_id = NULL WHERE actor_id = ?", [user.id]);
    await tx.execute("UPDATE audit_events SET actor_id = NULL WHERE actor_id = ?", [user.id]);
    await tx.execute("DELETE FROM sharing_preferences WHERE user_id = ?", [user.id]);
    await tx.execute("DELETE FROM community_members WHERE user_id = ?", [user.id]);
    await tx.execute("DELETE FROM sessions WHERE user_id = ?", [user.id]);
    await tx.execute("DELETE FROM password_resets WHERE user_id = ?", [user.id]);
    await tx.execute("DELETE FROM legal_acceptances WHERE user_id = ?", [user.id]);
    await tx.execute(
      "INSERT INTO data_requests (id, user_id, kind, status, notes, created_at, processed_at) VALUES (?,?,?,?,?,?,?)",
      [newId("req"), user.id, "delete", "completed", "Conta anonymizada e dados pessoais removidos.", now, now],
    );
    await tx.execute(
      `UPDATE users SET email = ?, name = ?, password_hash = ?, avatar_color = '#8c837a', bio = NULL,
         city = NULL, privacy_rank = 0, privacy_profile = 0, notify_comments = 0, notify_reactions = 0,
         notify_challenges = 0, notify_reminders = 0, deleted_at = ?, updated_at = ? WHERE id = ?`,
      [
        `deleted+${user.id}@invalid.local`,
        "Conta excluída",
        `deleted$${crypto.randomUUID()}`,
        now,
        now,
        user.id,
      ],
    );
  });

  await recordAudit({
    actorId: null,
    action: "data.account_delete",
    entityType: "user",
    entityId: user.id,
  });
  await destroySession();
  redirect("/?excluida=1");
}
