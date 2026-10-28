"use server";

import "server-only";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { execute, newId, nowIso, queryOne, withTransaction } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { membershipFor, isManager } from "@/lib/authz";
import { generateToken, hashToken } from "@/lib/auth/password";
import { rateLimit } from "@/lib/auth/rate-limit";
import { requestIpHash } from "@/lib/request-context";
import { recordAudit } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import { getCommunityById } from "@/lib/data/communities";
import { siteUrl } from "@/lib/env";
import type { ActionState } from "@/lib/actions/types";

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

const CATEGORIES = ["profile", "habits", "vaccines", "exams"] as const;

async function createSharingDefaults(
  userId: string,
  communityId: string,
): Promise<void> {
  const now = nowIso();
  for (const category of CATEGORIES) {
    await execute(
      "INSERT INTO sharing_preferences (id, user_id, community_id, category, shared, updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT DO NOTHING",
      [newId("shr"), userId, communityId, category, category === "profile" ? 1 : 0, now],
    );
  }
}

export async function createCommunityAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/comunidade");
  const parsed = z
    .object({
      name: z.string().trim().min(3, "Use pelo menos 3 caracteres.").max(80),
      description: z.string().trim().max(280).optional(),
    })
    .safeParse({
      name: formData.get("name"),
      description: formData.get("description") || undefined,
    });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const ipHash = await requestIpHash();
  const limit = rateLimit(`community:${ipHash}`, 5, 60 * 60_000);
  if (!limit.ok) return { error: "Muitas comunidades criadas em pouco tempo." };

  const base = slugify(parsed.data.name) || "comunidade";
  let slug = base;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const existing = await queryOne<{ id: string }>(
      "SELECT id FROM communities WHERE slug = ? LIMIT 1",
      [slug],
    );
    if (!existing) break;
    slug = `${base}-${generateToken().slice(0, 5).toLowerCase()}`;
  }

  const communityId = newId("com");
  const now = nowIso();
  await withTransaction(async (tx) => {
    await tx.execute(
      "INSERT INTO communities (id, slug, name, description, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?)",
      [communityId, slug, parsed.data.name, parsed.data.description ?? "", user.id, now, now],
    );
    await tx.execute(
      "INSERT INTO community_members (id, community_id, user_id, role, joined_at) VALUES (?,?,?,?,?)",
      [newId("mem"), communityId, user.id, "owner", now],
    );
  });
  await createSharingDefaults(user.id, communityId);
  await recordAudit({
    actorId: user.id,
    action: "community.create",
    entityType: "community",
    entityId: communityId,
    communityId,
  });
  revalidatePath("/comunidade");
  redirect(`/comunidade/${slug}`);
}

export async function joinByInviteAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const token = String(formData.get("token") ?? "");
  const next = `/convite/${token}`;
  const user = await requireUser(next);
  if (!token) return { error: "Convite inválido." };
  const hash = hashToken(token);
  const row = await queryOne<{
    id: string;
    slug: string;
    name: string;
    invite_expires_at: string | null;
    created_by: string;
  }>(
    "SELECT id, slug, name, invite_expires_at, created_by FROM communities WHERE invite_token_hash = ? AND archived_at IS NULL LIMIT 1",
    [hash],
  );
  if (!row) return { error: "Este convite não existe ou foi revogado." };
  if (row.invite_expires_at && new Date(row.invite_expires_at).getTime() <= Date.now()) {
    return { error: "Este convite expirou. Peça um novo link a quem administra a comunidade." };
  }
  const communityId = String(row.id);
  const existing = await membershipFor(user.id, communityId);
  if (existing) redirect(`/comunidade/${row.slug}`);

  const now = nowIso();
  await execute(
    "INSERT INTO community_members (id, community_id, user_id, role, joined_at) VALUES (?,?,?,?,?) ON CONFLICT DO NOTHING",
    [newId("mem"), communityId, user.id, "member", now],
  );
  await createSharingDefaults(user.id, communityId);
  await notify({
    userId: String(row.created_by),
    actorId: user.id,
    kind: "community",
    title: `${user.name} entrou na comunidade`,
    body: `Agora ${user.name} faz parte de ${row.name}.`,
    href: `/comunidade/${row.slug}/membros`,
  });
  await recordAudit({
    actorId: user.id,
    action: "community.join",
    entityType: "community",
    entityId: communityId,
    communityId,
  });
  revalidatePath(`/comunidade/${row.slug}`);
  redirect(`/comunidade/${row.slug}`);
}

export async function leaveCommunityAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/comunidade");
  const communityId = String(formData.get("communityId") ?? "");
  const membership = await membershipFor(user.id, communityId);
  if (!membership) return { error: "Você não participa desta comunidade." };
  const community = await getCommunityById(communityId);
  if (!community) return { error: "Comunidade não encontrada." };

  if (membership.role === "owner") {
    const others = await queryOne<{ total: unknown }>(
      "SELECT COUNT(*) AS total FROM community_members WHERE community_id = ? AND user_id != ?",
      [communityId, user.id],
    );
    if (Number(others?.total ?? 0) > 0) {
      return {
        error:
          "Você é proprietário e há outras pessoas na comunidade. Transfira a posse para alguém antes de sair.",
      };
    }
    await withTransaction(async (tx) => {
      await tx.execute("DELETE FROM sharing_preferences WHERE community_id = ?", [communityId]);
      await tx.execute("DELETE FROM community_members WHERE community_id = ?", [communityId]);
      await tx.execute("UPDATE communities SET archived_at = ? WHERE id = ?", [nowIso(), communityId]);
    });
  } else {
    await withTransaction(async (tx) => {
      await tx.execute("DELETE FROM sharing_preferences WHERE community_id = ? AND user_id = ?", [
        communityId,
        user.id,
      ]);
      await tx.execute("DELETE FROM community_members WHERE community_id = ? AND user_id = ?", [
        communityId,
        user.id,
      ]);
    });
  }
  await recordAudit({
    actorId: user.id,
    action: "community.leave",
    entityType: "community",
    entityId: communityId,
    communityId,
  });
  revalidatePath("/comunidade");
  redirect("/comunidade");
}

export async function removeMemberAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/comunidade");
  const communityId = String(formData.get("communityId") ?? "");
  const targetId = String(formData.get("userId") ?? "");
  const membership = await membershipFor(user.id, communityId);
  if (!membership || !isManager(membership.role)) {
    return { error: "Apenas administradores podem remover membros." };
  }
  const target = await membershipFor(targetId, communityId);
  if (!target) return { error: "Membro não encontrado." };
  if (target.role === "owner") return { error: "O proprietário não pode ser removido." };
  if (targetId === user.id) return { error: "Use a opção de sair da comunidade." };

  await withTransaction(async (tx) => {
    await tx.execute("DELETE FROM sharing_preferences WHERE community_id = ? AND user_id = ?", [
      communityId,
      targetId,
    ]);
    await tx.execute("DELETE FROM community_members WHERE community_id = ? AND user_id = ?", [
      communityId,
      targetId,
    ]);
  });
  const community = await getCommunityById(communityId);
  await notify({
    userId: targetId,
    actorId: user.id,
    kind: "community",
    title: "Você saiu de uma comunidade",
    body: `Seu acesso à comunidade ${community?.name ?? ""} foi removido.`,
    href: "/comunidade",
  });
  await recordAudit({
    actorId: user.id,
    action: "community.member_remove",
    entityType: "community_member",
    entityId: targetId,
    communityId,
  });
  revalidatePath(`/comunidade/${community?.slug ?? ""}/membros`);
  return { ok: true, message: "Membro removido." };
}

export async function promoteMemberAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/comunidade");
  const communityId = String(formData.get("communityId") ?? "");
  const targetId = String(formData.get("userId") ?? "");
  const role = formData.get("role") === "admin" ? "admin" : "member";
  const membership = await membershipFor(user.id, communityId);
  if (!membership || membership.role !== "owner") {
    return { error: "Apenas o proprietário pode alterar papéis." };
  }
  const target = await membershipFor(targetId, communityId);
  if (!target || target.role === "owner") {
    return { error: "Papel inválido para este membro." };
  }
  await execute("UPDATE community_members SET role = ? WHERE id = ?", [role, target.id]);
  await recordAudit({
    actorId: user.id,
    action: "community.member_role",
    entityType: "community_member",
    entityId: targetId,
    communityId,
    metadata: { role },
  });
  const community = await getCommunityById(communityId);
  revalidatePath(`/comunidade/${community?.slug ?? ""}/membros`);
  return { ok: true, message: "Papel atualizado." };
}

export async function regenerateInviteAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/comunidade");
  const communityId = String(formData.get("communityId") ?? "");
  const membership = await membershipFor(user.id, communityId);
  if (!membership || !isManager(membership.role)) {
    return { error: "Apenas administradores podem gerar convites." };
  }
  const token = generateToken();
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await execute(
    "UPDATE communities SET invite_token_hash = ?, invite_expires_at = ?, updated_at = ? WHERE id = ?",
    [hashToken(token), expires.toISOString(), nowIso(), communityId],
  );
  const community = await getCommunityById(communityId);
  await recordAudit({
    actorId: user.id,
    action: "community.invite_regenerate",
    entityType: "community",
    entityId: communityId,
    communityId,
  });
  revalidatePath(`/comunidade/${community?.slug ?? ""}`);
  return {
    ok: true,
    message: "Convite válido por 7 dias.",
    link: `${siteUrl()}/convite/${token}`,
    linkLabel: "Link de convite",
  };
}

export async function revokeInviteAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/comunidade");
  const communityId = String(formData.get("communityId") ?? "");
  const membership = await membershipFor(user.id, communityId);
  if (!membership || !isManager(membership.role)) {
    return { error: "Apenas administradores podem revogar convites." };
  }
  await execute(
    "UPDATE communities SET invite_token_hash = NULL, invite_expires_at = NULL, updated_at = ? WHERE id = ?",
    [nowIso(), communityId],
  );
  const community = await getCommunityById(communityId);
  await recordAudit({
    actorId: user.id,
    action: "community.invite_revoke",
    entityType: "community",
    entityId: communityId,
    communityId,
  });
  revalidatePath(`/comunidade/${community?.slug ?? ""}`);
  return { ok: true, message: "Convite revogado." };
}

export async function updateCommunityAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/comunidade");
  const communityId = String(formData.get("communityId") ?? "");
  const parsed = z
    .object({
      name: z.string().trim().min(3).max(80),
      description: z.string().trim().max(280),
    })
    .safeParse({
      name: formData.get("name"),
      description: formData.get("description") ?? "",
    });
  if (!parsed.success) return { error: "Dados inválidos." };
  const membership = await membershipFor(user.id, communityId);
  if (!membership || !isManager(membership.role)) {
    return { error: "Apenas administradores podem editar a comunidade." };
  }
  await execute(
    "UPDATE communities SET name = ?, description = ?, updated_at = ? WHERE id = ?",
    [parsed.data.name, parsed.data.description, nowIso(), communityId],
  );
  const community = await getCommunityById(communityId);
  await recordAudit({
    actorId: user.id,
    action: "community.update",
    entityType: "community",
    entityId: communityId,
    communityId,
  });
  revalidatePath(`/comunidade/${community?.slug ?? ""}`);
  return { ok: true, message: "Comunidade atualizada." };
}


