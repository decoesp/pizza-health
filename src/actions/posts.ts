"use server";

import "server-only";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { execute, newId, nowIso, query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { isManager, membershipFor } from "@/lib/authz";
import { getCommunityById } from "@/lib/data/communities";
import { getPost, REACTIONS, type ReactionKind } from "@/lib/data/feed";
import { awardSocial, evaluateAchievements } from "@/lib/data/points";
import { notify } from "@/lib/notifications";
import { recordAudit } from "@/lib/audit";
import type { ActionState } from "@/lib/actions/types";

const REACTION_KINDS = new Set<string>(REACTIONS.map((reaction) => reaction.kind));

async function communitySlug(communityId: string): Promise<string> {
  const community = await getCommunityById(communityId);
  return community?.slug ?? "";
}

async function notifyManagers(
  communityId: string,
  actorId: string,
  title: string,
  href: string,
): Promise<void> {
  const managers = await query<{ user_id: string }>(
    "SELECT user_id FROM community_members WHERE community_id = ? AND role IN ('owner','admin') AND user_id != ?",
    [communityId, actorId],
  );
  for (const manager of managers) {
    await notify({
      userId: String(manager.user_id),
      actorId,
      kind: "community",
      title,
      href,
    });
  }
}

export async function createPostAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/comunidade");
  const communityId = String(formData.get("communityId") ?? "");
  const membership = await membershipFor(user.id, communityId);
  if (!membership) return { error: "Você não participa desta comunidade." };
  const parsed = z
    .object({
      body: z.string().trim().min(2, "Escreva pelo menos 2 caracteres.").max(1200),
      visibility: z.enum(["community", "private"]).default("community"),
      milestone: z.string().optional(),
    })
    .safeParse({
      body: formData.get("body"),
      visibility: formData.get("visibility") ?? "community",
      milestone: formData.get("milestone") ?? undefined,
    });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Publicação inválida." };
  }
  const now = nowIso();
  const postId = newId("post");
  await execute(
    "INSERT INTO posts (id, community_id, user_id, body, kind, ref_id, visibility, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
    [
      postId,
      communityId,
      user.id,
      parsed.data.body,
      parsed.data.milestone ? "milestone" : "text",
      null,
      parsed.data.visibility,
      now,
      now,
    ],
  );
  await recordAudit({
    actorId: user.id,
    action: "post.create",
    entityType: "post",
    entityId: postId,
    communityId,
    metadata: { visibility: parsed.data.visibility },
  });
  revalidatePath(`/comunidade/${await communitySlug(communityId)}`);
  return { ok: true, message: "Publicação criada." };
}

export async function addCommentAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/comunidade");
  const postId = String(formData.get("postId") ?? "");
  const post = await getPost(postId);
  if (!post) return { error: "Publicação não encontrada." };
  const membership = await membershipFor(user.id, post.communityId);
  if (!membership) return { error: "Você não participa desta comunidade." };
  if (post.visibility === "private" && post.userId !== user.id) {
    return { error: "Publicação não encontrada." };
  }
  const parsed = z
    .object({ body: z.string().trim().min(1, "Escreva um comentário.").max(600) })
    .safeParse({ body: formData.get("body") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Comentário inválido." };
  }
  const commentId = newId("cmt");
  await execute(
    "INSERT INTO comments (id, post_id, user_id, body, created_at) VALUES (?,?,?,?,?)",
    [commentId, postId, user.id, parsed.data.body, nowIso()],
  );
  await awardSocial(user.id, "comment", "comment", commentId);
  await notify({
    userId: post.userId,
    actorId: user.id,
    kind: "comment",
    title: `${user.name} comentou na sua publicação`,
    body: "Abra a comunidade para responder.",
    href: `/comunidade/${await communitySlug(post.communityId)}#post-${postId}`,
  });
  await evaluateAchievements(user.id);
  await recordAudit({
    actorId: user.id,
    action: "comment.create",
    entityType: "comment",
    entityId: commentId,
    communityId: post.communityId,
  });
  revalidatePath(`/comunidade/${await communitySlug(post.communityId)}`);
  return { ok: true, message: "Comentário enviado." };
}

export async function toggleReactionAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/comunidade");
  const postId = String(formData.get("postId") ?? "");
  const kindRaw = String(formData.get("kind") ?? "");
  if (!REACTION_KINDS.has(kindRaw)) return { error: "Reação inválida." };
  const kind = kindRaw as ReactionKind;
  const post = await getPost(postId);
  if (!post) return { error: "Publicação não encontrada." };
  const membership = await membershipFor(user.id, post.communityId);
  if (!membership) return { error: "Você não participa desta comunidade." };
  if (post.visibility === "private" && post.userId !== user.id) {
    return { error: "Publicação não encontrada." };
  }

  const existing = await queryOne<{ id: string }>(
    "SELECT id FROM reactions WHERE post_id = ? AND user_id = ? AND kind = ? LIMIT 1",
    [postId, user.id, kind],
  );
  if (existing) {
    await execute("DELETE FROM reactions WHERE id = ?", [String(existing.id)]);
    revalidatePath(`/comunidade/${await communitySlug(post.communityId)}`);
    return { ok: true, message: "Reação removida." };
  }

  const reactionId = newId("rea");
  await execute(
    "INSERT INTO reactions (id, post_id, user_id, kind, created_at) VALUES (?,?,?,?,?) ON CONFLICT DO NOTHING",
    [reactionId, postId, user.id, kind, nowIso()],
  );
  await awardSocial(user.id, "reaction", "reaction", reactionId);
  await notify({
    userId: post.userId,
    actorId: user.id,
    kind: "reaction",
    title: `${user.name} reagiu à sua publicação`,
    body: "Abra a comunidade para ver.",
    href: `/comunidade/${await communitySlug(post.communityId)}#post-${postId}`,
  });
  revalidatePath(`/comunidade/${await communitySlug(post.communityId)}`);
  return { ok: true, message: "Reação registrada." };
}

export async function deletePostAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/comunidade");
  const postId = String(formData.get("postId") ?? "");
  const post = await getPost(postId);
  if (!post) return { error: "Publicação não encontrada." };
  const membership = await membershipFor(user.id, post.communityId);
  if (!membership) return { error: "Você não participa desta comunidade." };
  if (post.userId !== user.id && !isManager(membership.role)) {
    return { error: "Você não pode apagar esta publicação." };
  }
  await execute("UPDATE posts SET deleted_at = ?, updated_at = ? WHERE id = ?", [
    nowIso(),
    nowIso(),
    postId,
  ]);
  await recordAudit({
    actorId: user.id,
    action: post.userId === user.id ? "post.delete_own" : "post.delete_moderation",
    entityType: "post",
    entityId: postId,
    communityId: post.communityId,
  });
  revalidatePath(`/comunidade/${await communitySlug(post.communityId)}`);
  return { ok: true, message: "Publicação removida." };
}

export async function reportPostAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/comunidade");
  const postId = String(formData.get("postId") ?? "");
  const post = await getPost(postId);
  if (!post) return { error: "Publicação não encontrada." };
  const membership = await membershipFor(user.id, post.communityId);
  if (!membership) return { error: "Você não participa desta comunidade." };
  const parsed = z
    .object({
      reason: z.enum(["assedio", "discurso_de_odio", "desinformacao", "spam", "outro"]),
      details: z.string().trim().max(500).optional(),
    })
    .safeParse({
      reason: formData.get("reason"),
      details: formData.get("details") || undefined,
    });
  if (!parsed.success) return { error: "Escolha um motivo válido." };
  const duplicate = await queryOne<{ id: string }>(
    "SELECT id FROM content_reports WHERE post_id = ? AND reporter_id = ? AND status IN ('open','reviewing') LIMIT 1",
    [postId, user.id],
  );
  if (duplicate) return { error: "Você já denunciou esta publicação." };
  await execute(
    "INSERT INTO content_reports (id, post_id, reporter_id, reason, details, status, created_at) VALUES (?,?,?,?,?,?,?)",
    [newId("rep"), postId, user.id, parsed.data.reason, parsed.data.details ?? null, "open", nowIso()],
  );
  await notifyManagers(
    post.communityId,
    user.id,
    "Nova denúncia na comunidade",
    `/comunidade/${await communitySlug(post.communityId)}/moderacao`,
  );
  await recordAudit({
    actorId: user.id,
    action: "post.report",
    entityType: "post",
    entityId: postId,
    communityId: post.communityId,
    metadata: { reason: parsed.data.reason },
  });
  return { ok: true, message: "Denúncia registrada. A moderação foi avisada." };
}

export async function resolveReportAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/comunidade");
  const reportId = String(formData.get("reportId") ?? "");
  const status = formData.get("status") === "dismissed" ? "dismissed" : "resolved";
  const report = await queryOne<{ id: string; post_id: string }>(
    "SELECT id, post_id FROM content_reports WHERE id = ? LIMIT 1",
    [reportId],
  );
  if (!report) return { error: "Denúncia não encontrada." };
  const post = await getPost(String(report.post_id));
  if (!post) return { error: "Publicação não encontrada." };
  const membership = await membershipFor(user.id, post.communityId);
  if (!membership || !isManager(membership.role)) {
    return { error: "Apenas a moderação pode resolver denúncias." };
  }
  await execute(
    "UPDATE content_reports SET status = ?, resolved_at = ?, resolved_by = ? WHERE id = ?",
    [status, nowIso(), user.id, reportId],
  );
  await recordAudit({
    actorId: user.id,
    action: "report.resolve",
    entityType: "content_report",
    entityId: reportId,
    communityId: post.communityId,
    metadata: { status },
  });
  revalidatePath(`/comunidade/${await communitySlug(post.communityId)}/moderacao`);
  return { ok: true, message: status === "resolved" ? "Denúncia resolvida." : "Denúncia arquivada." };
}

export async function moderateDeletePostAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/comunidade");
  const postId = String(formData.get("postId") ?? "");
  const post = await getPost(postId);
  if (!post) return { error: "Publicação não encontrada." };
  const membership = await membershipFor(user.id, post.communityId);
  if (!membership || !isManager(membership.role)) {
    return { error: "Apenas a moderação pode remover publicações." };
  }
  const now = nowIso();
  await execute("UPDATE posts SET deleted_at = ?, updated_at = ? WHERE id = ?", [
    now,
    now,
    postId,
  ]);
  await execute(
    "UPDATE content_reports SET status = 'resolved', resolved_at = ?, resolved_by = ? WHERE post_id = ? AND status IN ('open','reviewing')",
    [now, user.id, postId],
  );
  await recordAudit({
    actorId: user.id,
    action: "post.delete_moderation",
    entityType: "post",
    entityId: postId,
    communityId: post.communityId,
  });
  revalidatePath(`/comunidade/${await communitySlug(post.communityId)}/moderacao`);
  revalidatePath(`/comunidade/${await communitySlug(post.communityId)}`);
  return { ok: true, message: "Publicação removida pela moderação." };
}
