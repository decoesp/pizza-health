"use server";

import "server-only";
import { z } from "zod";
import { execute, newId, nowIso, queryOne } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { generateToken, hashToken } from "@/lib/auth/password";
import { recordAudit } from "@/lib/audit";
import { siteUrl } from "@/lib/env";
import type { ActionState } from "@/lib/actions/types";

export async function generateResetLinkAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = z.string().trim().toLowerCase().email().safeParse(formData.get("email"));
  if (!parsed.success) return { error: "Informe um e-mail válido." };
  const user = await queryOne<{ id: string; name: string }>(
    "SELECT id, name FROM users WHERE email = ? AND deleted_at IS NULL LIMIT 1",
    [parsed.data],
  );
  if (!user) return { error: "Não há conta ativa com este e-mail." };
  const token = generateToken();
  const now = new Date();
  const expires = new Date(now.getTime() + 60 * 60 * 1000);
  await execute(
    "INSERT INTO password_resets (id, user_id, token_hash, expires_at, used_at, created_at, requested_ip_hash) VALUES (?,?,?,?,?,?,?)",
    [newId("rst"), String(user.id), hashToken(token), expires.toISOString(), null, now.toISOString(), null],
  );
  await recordAudit({
    actorId: admin.id,
    action: "admin.password_reset_link",
    entityType: "user",
    entityId: String(user.id),
  });
  return {
    ok: true,
    message: `Link de uso único para ${user.name}, válido por 1 hora. Entregue por um canal seguro.`,
    link: `${siteUrl()}/redefinir/${token}`,
    linkLabel: "Link de redefinição",
  };
}

export async function resolveDataRequestAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const requestId = String(formData.get("requestId") ?? "");
  const status = formData.get("status") === "rejected" ? "rejected" : "completed";
  const request = await queryOne<{ id: string; user_id: string }>(
    "SELECT id, user_id FROM data_requests WHERE id = ? LIMIT 1",
    [requestId],
  );
  if (!request) return { error: "Solicitação não encontrada." };
  await execute("UPDATE data_requests SET status = ?, processed_at = ? WHERE id = ?", [
    status,
    nowIso(),
    requestId,
  ]);
  await recordAudit({
    actorId: admin.id,
    action: "admin.data_request_resolve",
    entityType: "data_request",
    entityId: requestId,
    metadata: { status },
  });
  return { ok: true, message: "Solicitação atualizada." };
}
