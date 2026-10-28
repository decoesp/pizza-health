"use server";

import "server-only";
import { z } from "zod";
import { redirect } from "next/navigation";
import { execute, newId, nowIso, queryOne, withTransaction } from "@/lib/db";
import { hashPassword, hashToken, generateToken, passwordProblems, verifyPassword } from "@/lib/auth/password";
import {
  createSession,
  destroySession,
  getCurrentUser,
  requireUser,
  SESSION_COOKIE,
} from "@/lib/auth/session";
import { rateLimit, resetRateLimit } from "@/lib/auth/rate-limit";
import { requestIpHash } from "@/lib/request-context";
import { ensureDefaultHabits } from "@/lib/data/habits";
import { notify } from "@/lib/notifications";
import { recordAudit } from "@/lib/audit";
import { getEnv, oidcConfigured, oidcPostLogoutRedirectUri, siteUrl } from "@/lib/env";
import { uniqueCommunitySlug } from "@/lib/domain/slug";
import { cookies } from "next/headers";
import type { ActionState } from "@/lib/actions/types";

const emailSchema = z.string().trim().toLowerCase().email("Informe um e-mail válido.");

function safeNext(value: unknown, fallback = "/inicio"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

export async function registerAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = z
    .object({
      name: z.string().trim().min(2, "Informe pelo menos 2 caracteres.").max(80),
      email: emailSchema,
      password: z.string().min(1, "Informe uma senha."),
      confirm: z.string(),
      accept: z.string().optional(),
      ranking: z.string().optional(),
      next: z.string().optional(),
    })
    .safeParse({
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
      confirm: formData.get("confirm"),
      accept: formData.get("accept") ?? undefined,
      ranking: formData.get("ranking") ?? undefined,
      next: formData.get("next") ?? undefined,
    });

  if (!parsed.success) {
    return { error: "Confira os campos destacados.", fieldErrors: {} };
  }
  const data = parsed.data;
  if (data.password !== data.confirm) {
    return { error: "As senhas não coincidem.", fieldErrors: { confirm: "As senhas não coincidem." } };
  }
  const problems = passwordProblems(data.password);
  if (problems.length > 0) {
    return { error: problems.join(" "), fieldErrors: { password: problems.join(" ") } };
  }
  if (!data.accept) {
    return { error: "É necessário aceitar os termos e a política de privacidade." };
  }

  const ipHash = await requestIpHash();
  const limit = rateLimit(`register:${ipHash}`, 5, 10 * 60_000);
  if (!limit.ok) {
    return {
      error: `Muitas tentativas de cadastro. Tente novamente em ${Math.ceil(limit.retryAfterSeconds / 60)} min.`,
    };
  }

  const existing = await queryOne<{ id: string }>(
    "SELECT id FROM users WHERE email = ? LIMIT 1",
    [data.email],
  );
  if (existing) {
    return { error: "Já existe uma conta com este e-mail. Entre para continuar." };
  }

  const userId = newId("usr");
  const passwordHash = await hashPassword(data.password);
  const now = nowIso();
  const colors = ["#C2410C", "#3F6B4F", "#8A5A0F", "#4C6FA8", "#8A5A8F"];
  const color = colors[Math.floor(Math.random() * colors.length)] ?? "#C2410C";
  const communityId = newId("com");
  const slug = await uniqueCommunitySlug(`cuidado-${data.name}`);
  const firstName = data.name.split(/\s+/)[0] || data.name;

  await withTransaction(async (tx) => {
    await tx.execute(
      `INSERT INTO users (id, email, name, password_hash, role, avatar_color, privacy_rank, privacy_profile,
        notify_comments, notify_reactions, notify_challenges, notify_reminders, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        userId,
        data.email,
        data.name,
        passwordHash,
        "user",
        color,
        data.ranking ? 1 : 0,
        1,
        1,
        1,
        1,
        1,
        now,
        now,
      ],
    );
    await tx.execute(
      "INSERT INTO legal_acceptances (id, user_id, kind, version, accepted_at) VALUES (?,?,?,?,?)",
      [newId("leg"), userId, "terms", "2026-10", now],
    );
    await tx.execute(
      "INSERT INTO legal_acceptances (id, user_id, kind, version, accepted_at) VALUES (?,?,?,?,?)",
      [newId("leg"), userId, "privacy", "2026-10", now],
    );
    await tx.execute(
      "INSERT INTO legal_acceptances (id, user_id, kind, version, accepted_at) VALUES (?,?,?,?,?)",
      [newId("leg"), userId, "health_data", "2026-10", now],
    );
    await tx.execute(
      `INSERT INTO communities (id, slug, name, description, created_by, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?)`,
      [
        communityId,
        slug,
        `Cuidado de ${firstName}`,
        "Um espaço privado para começar. Convide pessoas de confiança quando quiser.",
        userId,
        now,
        now,
      ],
    );
    await tx.execute(
      "INSERT INTO community_members (id, community_id, user_id, role, joined_at) VALUES (?,?,?,?,?)",
      [newId("mem"), communityId, userId, "owner", now],
    );
    for (const category of ["profile", "habits", "vaccines", "exams"]) {
      await tx.execute(
        "INSERT INTO sharing_preferences (id, user_id, community_id, category, shared, updated_at) VALUES (?,?,?,?,?,?)",
        [newId("shr"), userId, communityId, category, category === "profile" ? 1 : 0, now],
      );
    }
  });

  await ensureDefaultHabits(userId);
  await notify({
    userId,
    kind: "system",
    title: "Bem-vindo ao Pizza Health",
    body: "Seu espaço está pronto. Comece registrando um hábito ou convidando sua turma.",
    href: "/inicio",
  });
  await recordAudit({
    actorId: userId,
    action: "user.register",
    entityType: "user",
    entityId: userId,
  });
  await createSession(userId);
  redirect(safeNext(data.next));
}

export async function loginAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = z
    .object({
      email: emailSchema,
      password: z.string().min(1, "Informe sua senha."),
      next: z.string().optional(),
    })
    .safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
      next: formData.get("next") ?? undefined,
    });

  if (!parsed.success) {
    return { error: "Confira o e-mail e a senha." };
  }

  const ipHash = await requestIpHash();
  const limit = rateLimit(`login:${ipHash}:${parsed.data.email}`, 8, 10 * 60_000);
  if (!limit.ok) {
    return {
      error: `Muitas tentativas. Tente novamente em ${Math.ceil(limit.retryAfterSeconds / 60)} min.`,
    };
  }

  const row = await queryOne<{ id: string; password_hash: string; deleted_at: string | null }>(
    "SELECT id, password_hash, deleted_at FROM users WHERE email = ? LIMIT 1",
    [parsed.data.email],
  );
  const valid = row ? await verifyPassword(parsed.data.password, String(row.password_hash)) : false;
  if (!row || row.deleted_at || !valid) {
    return { error: "E-mail ou senha incorretos." };
  }

  resetRateLimit(`login:${ipHash}:${parsed.data.email}`);
  await execute("UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?", [
    nowIso(),
    nowIso(),
    String(row.id),
  ]);
  await createSession(String(row.id));
  await recordAudit({
    actorId: String(row.id),
    action: "user.login",
    entityType: "user",
    entityId: String(row.id),
  });
  redirect(safeNext(parsed.data.next));
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  if (oidcConfigured()) {
    const env = getEnv();
    const url = new URL(`${env.OIDC_ISSUER.replace(/\/$/, "")}/logout`);
    url.searchParams.set("client_id", env.OIDC_CLIENT_ID);
    url.searchParams.set("post_logout_redirect_uri", oidcPostLogoutRedirectUri());
    redirect(url.toString());
  }
  redirect("/");
}

export async function requestPasswordResetAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { error: "Informe um e-mail válido." };
  const email = parsed.data;
  const ipHash = await requestIpHash();
  const limit = rateLimit(`reset:${ipHash}`, 5, 15 * 60_000);
  if (!limit.ok) {
    return { error: "Muitas solicitações. Tente mais tarde." };
  }

  const user = await queryOne<{ id: string }>(
    "SELECT id FROM users WHERE email = ? AND deleted_at IS NULL LIMIT 1",
    [email],
  );
  const generic =
    "Se houver uma conta com este e-mail, a solicitação foi registrada. Neste ambiente o envio automático de e-mail não está configurado; um administrador pode gerar um link de redefinição.";

  if (!user) return { ok: true, message: generic };

  const token = generateToken();
  const now = new Date();
  const expires = new Date(now.getTime() + 60 * 60 * 1000);
  await execute(
    "INSERT INTO password_resets (id, user_id, token_hash, expires_at, used_at, created_at, requested_ip_hash) VALUES (?,?,?,?,?,?,?)",
    [newId("rst"), String(user.id), hashToken(token), expires.toISOString(), null, now.toISOString(), ipHash],
  );
  await recordAudit({
    actorId: null,
    action: "user.password_reset_request",
    entityType: "user",
    entityId: String(user.id),
  });

  const link = `${siteUrl()}/redefinir/${token}`;
  const env = process.env.ALLOW_RESET_LINK_IN_UI === "1";
  return {
    ok: true,
    message: generic,
    ...(env ? { link, linkLabel: "Link de teste (ambiente de desenvolvimento)" } : {}),
  };
}

export async function resetPasswordAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = z
    .object({
      token: z.string().min(10),
      password: z.string().min(1),
      confirm: z.string(),
    })
    .safeParse({
      token: formData.get("token"),
      password: formData.get("password"),
      confirm: formData.get("confirm"),
    });
  if (!parsed.success) return { error: "Dados inválidos." };
  if (parsed.data.password !== parsed.data.confirm) {
    return { error: "As senhas não coincidem." };
  }
  const problems = passwordProblems(parsed.data.password);
  if (problems.length > 0) return { error: problems.join(" ") };

  const tokenHash = hashToken(parsed.data.token);
  const row = await queryOne<{ id: string; user_id: string; expires_at: string; used_at: string | null }>(
    "SELECT id, user_id, expires_at, used_at FROM password_resets WHERE token_hash = ? LIMIT 1",
    [tokenHash],
  );
  if (!row || row.used_at || new Date(row.expires_at).getTime() <= Date.now()) {
    return { error: "Este link é inválido ou expirou. Solicite um novo." };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const now = nowIso();
  await withTransaction(async (tx) => {
    await tx.execute("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?", [
      passwordHash,
      now,
      String(row.user_id),
    ]);
    await tx.execute("UPDATE password_resets SET used_at = ? WHERE id = ?", [now, String(row.id)]);
    await tx.execute("DELETE FROM sessions WHERE user_id = ?", [String(row.user_id)]);
  });
  await recordAudit({
    actorId: String(row.user_id),
    action: "user.password_reset",
    entityType: "user",
    entityId: String(row.user_id),
  });
  redirect("/entrar?redefinida=1");
}

export async function changePasswordAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/perfil/seguranca");
  const current = String(formData.get("current") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password !== confirm) return { error: "As senhas novas não coincidem." };
  const problems = passwordProblems(password);
  if (problems.length > 0) return { error: problems.join(" ") };

  const row = await queryOne<{ password_hash: string }>(
    "SELECT password_hash FROM users WHERE id = ? LIMIT 1",
    [user.id],
  );
  if (!row || !(await verifyPassword(current, String(row.password_hash)))) {
    return { error: "A senha atual está incorreta." };
  }
  const passwordHash = await hashPassword(password);
  await execute("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?", [
    passwordHash,
    nowIso(),
    user.id,
  ]);
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await execute("DELETE FROM sessions WHERE user_id = ? AND token_hash != ?", [
      user.id,
      hashToken(token),
    ]);
  }
  await recordAudit({
    actorId: user.id,
    action: "user.password_change",
    entityType: "user",
    entityId: user.id,
  });
  return { ok: true, message: "Senha atualizada. As outras sessões foram encerradas." };
}

export async function logoutAllAction(): Promise<void> {
  const user = await getCurrentUser();
  if (user) {
    await execute("DELETE FROM sessions WHERE user_id = ?", [user.id]);
    await recordAudit({
      actorId: user.id,
      action: "user.logout_all",
      entityType: "user",
      entityId: user.id,
    });
  }
  await destroySession();
  redirect("/entrar?encerradas=1");
}


