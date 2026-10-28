import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { execute, query, queryOne } from "@/lib/db";
import { generateToken, hashToken } from "@/lib/auth/password";
import { getEnv } from "@/lib/env";
import { requestIpHash, requestUserAgent } from "@/lib/request-context";

export const SESSION_COOKIE = "pizza_health_session";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  avatarColor: string;
};

type SessionRow = {
  token_hash: string;
  expires_at: string;
  id: string;
  name: string;
  email: string;
  role: string;
  avatar_color: string;
};

function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  };
}

export async function createSession(userId: string): Promise<void> {
  const env = getEnv();
  const token = generateToken();
  const tokenHash = hashToken(token);
  const now = new Date();
  const expires = new Date(
    now.getTime() + env.SESSION_DAYS * 24 * 60 * 60 * 1000,
  );
  await execute(
    "INSERT INTO sessions (token_hash, user_id, expires_at, created_at, user_agent, ip_hash) VALUES (?,?,?,?,?,?)",
    [
      tokenHash,
      userId,
      expires.toISOString(),
      now.toISOString(),
      await requestUserAgent(),
      await requestIpHash(),
    ],
  );
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, cookieOptions(expires));
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await execute("DELETE FROM sessions WHERE token_hash = ?", [hashToken(token)]);
  }
  jar.set(SESSION_COOKIE, "", { ...cookieOptions(new Date(0)), maxAge: 0 });
}

export async function destroyAllSessions(userId: string): Promise<void> {
  await execute("DELETE FROM sessions WHERE user_id = ?", [userId]);
}

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = await queryOne<SessionRow>(
    `SELECT s.token_hash, s.expires_at, u.id, u.name, u.email, u.role, u.avatar_color
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND u.deleted_at IS NULL
      LIMIT 1`,
    [hashToken(token)],
  );
  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    await execute("DELETE FROM sessions WHERE token_hash = ?", [hashToken(token)]);
    return null;
  }
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    role: row.role === "admin" ? "admin" : "user",
    avatarColor: String(row.avatar_color),
  };
});

export async function requireUser(nextPath = "/inicio"): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/entrar?next=${encodeURIComponent(nextPath)}`);
  }
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser("/admin");
  if (user.role !== "admin") redirect("/inicio?erro=acesso");
  return user;
}

export function userInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "P";
}

export async function countActiveSessions(userId: string): Promise<number> {
  const rows = await query<{ total: unknown }>(
    "SELECT COUNT(*) AS total FROM sessions WHERE user_id = ? AND expires_at > ?",
    [userId, new Date().toISOString()],
  );
  return Number(rows[0]?.total ?? 0);
}

export async function listActiveSessions(userId: string): Promise<
  Array<{ userAgent: string; createdAt: string; expiresAt: string; ipHash: string | null }>
> {
  const rows = await query<{
    user_agent: string | null;
    created_at: string;
    expires_at: string;
    ip_hash: string | null;
  }>(
    "SELECT user_agent, created_at, expires_at, ip_hash FROM sessions WHERE user_id = ? AND expires_at > ? ORDER BY created_at DESC LIMIT 20",
    [userId, new Date().toISOString()],
  );
  return rows.map((row) => ({
    userAgent: row.user_agent ? String(row.user_agent) : "dispositivo desconhecido",
    createdAt: String(row.created_at),
    expiresAt: String(row.expires_at),
    ipHash: row.ip_hash ? String(row.ip_hash) : null,
  }));
}
