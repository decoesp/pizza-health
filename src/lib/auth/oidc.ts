import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { execute, newId, nowIso, queryOne } from "@/lib/db";
import { generateToken, hashPassword, hashToken } from "@/lib/auth/password";
import { provisionUser } from "@/lib/auth/provision";
import { getEnv, oidcRedirectUri, siteUrl } from "@/lib/env";

export const OIDC_PROVIDER = "pizza-auth";

type Discovery = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint?: string;
  jwks_uri: string;
  end_session_endpoint?: string;
};

type DiscoveryCache = {
  config: Discovery;
  fetchedAt: number;
};

let discoveryCache: DiscoveryCache | null = null;

function base64url(input: Buffer): string {
  return input.toString("base64url");
}

function sha256Base64url(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

export function safeNext(value: unknown, fallback = "/inicio"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }
  return value.slice(0, 300);
}

export async function getOidcDiscovery(): Promise<Discovery> {
  const env = getEnv();
  const issuer = env.OIDC_ISSUER.replace(/\/$/, "");
  const now = Date.now();
  if (discoveryCache && now - discoveryCache.fetchedAt < 60 * 60_000) {
    return discoveryCache.config;
  }
  const response = await fetch(`${issuer}/.well-known/openid-configuration`, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`OIDC discovery falhou (${response.status}).`);
  }
  const config = (await response.json()) as Discovery;
  if (
    config.issuer !== issuer ||
    !config.authorization_endpoint ||
    !config.token_endpoint ||
    !config.jwks_uri
  ) {
    throw new Error("OIDC discovery inválido.");
  }
  discoveryCache = { config, fetchedAt: now };
  return config;
}

export function resetOidcCacheForTests(): void {
  discoveryCache = null;
}

export async function createAuthorizationUrl(
  nextPath: string,
): Promise<string> {
  const env = getEnv();
  if (!env.OIDC_CLIENT_SECRET) {
    throw new Error("Pizza Auth não está configurado.");
  }
  const config = await getOidcDiscovery();
  const state = generateToken();
  const nonce = generateToken();
  const codeVerifier = base64url(randomBytes(48));
  const codeChallenge = sha256Base64url(codeVerifier);
  const now = new Date();
  const expires = new Date(now.getTime() + 10 * 60_000);

  await execute("DELETE FROM oidc_states WHERE expires_at < ?", [now.toISOString()]);
  await execute(
    `INSERT INTO oidc_states (state_hash, nonce, code_verifier, next_path, created_at, expires_at)
     VALUES (?,?,?,?,?,?)`,
    [
      hashToken(state),
      nonce,
      codeVerifier,
      safeNext(nextPath),
      now.toISOString(),
      expires.toISOString(),
    ],
  );

  const url = new URL(config.authorization_endpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", env.OIDC_CLIENT_ID);
  url.searchParams.set("redirect_uri", oidcRedirectUri());
  url.searchParams.set(
    "scope",
    "openid profile email offline_access",
  );
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("app", "Pizza Health");
  url.searchParams.set("theme", "light");
  return url.toString();
}

type StateRow = {
  nonce: string;
  code_verifier: string;
  next_path: string;
  expires_at: string;
};

async function consumeState(state: string): Promise<StateRow> {
  const stateHash = hashToken(state);
  const row = await queryOne<StateRow>(
    "SELECT nonce, code_verifier, next_path, expires_at FROM oidc_states WHERE state_hash = ? LIMIT 1",
    [stateHash],
  );
  if (!row) throw new Error("Estado OIDC inválido.");
  await execute("DELETE FROM oidc_states WHERE state_hash = ?", [stateHash]);
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    throw new Error("Estado OIDC expirado.");
  }
  return row;
}

async function exchangeCode(
  code: string,
  codeVerifier: string,
): Promise<{ idToken: string; accessToken: string }> {
  const env = getEnv();
  if (!env.OIDC_CLIENT_SECRET) {
    throw new Error("Pizza Auth não está configurado.");
  }
  const config = await getOidcDiscovery();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: oidcRedirectUri(),
    client_id: env.OIDC_CLIENT_ID,
    client_secret: env.OIDC_CLIENT_SECRET,
    code_verifier: codeVerifier,
  });
  const response = await fetch(config.token_endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body,
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Troca de código OIDC falhou (${response.status}).`);
  }
  const payload = (await response.json()) as {
    id_token?: unknown;
    access_token?: unknown;
  };
  if (typeof payload.id_token !== "string" || !payload.id_token) {
    throw new Error("OIDC não retornou id_token.");
  }
  return {
    idToken: payload.id_token,
    accessToken:
      typeof payload.access_token === "string" ? payload.access_token : "",
  };
}

async function verifyIdToken(
  idToken: string,
  nonce: string,
): Promise<JWTPayload> {
  const env = getEnv();
  const config = await getOidcDiscovery();
  const jwks = createRemoteJWKSet(new URL(config.jwks_uri), {
    cacheMaxAge: 10 * 60_000,
    cooldownDuration: 30_000,
  });
  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: env.OIDC_ISSUER.replace(/\/$/, ""),
    audience: env.OIDC_CLIENT_ID,
    clockTolerance: 30,
  });
  if (payload.nonce !== nonce) {
    throw new Error("Nonce OIDC inválido.");
  }
  return payload;
}

async function findOrCreateUser(
  subject: string,
  email: string,
  name: string,
): Promise<string> {
  const linked = await queryOne<{ user_id: string }>(
    "SELECT user_id FROM oauth_accounts WHERE provider = ? AND subject = ? LIMIT 1",
    [OIDC_PROVIDER, subject],
  );
  if (linked) return String(linked.user_id);

  const existing = await queryOne<{ id: string; deleted_at: string | null }>(
    "SELECT id, deleted_at FROM users WHERE email = ? LIMIT 1",
    [email],
  );
  if (existing?.deleted_at) {
    throw new Error("Conta excluída.");
  }

  let userId: string;
  if (existing) {
    userId = String(existing.id);
  } else {
    const randomPassword = await hashPassword(generateToken());
    const created = await provisionUser({
      name: name || email.split("@")[0] || "Pessoa",
      email,
      passwordHash: randomPassword,
      ranking: false,
    });
    userId = created.userId;
  }

  const now = nowIso();
  await execute(
    `INSERT INTO oauth_accounts (id, provider, subject, user_id, email, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?) ON CONFLICT DO NOTHING`,
    [newId("oac"), OIDC_PROVIDER, subject, userId, email, now, now],
  );
  const confirmed = await queryOne<{ user_id: string }>(
    "SELECT user_id FROM oauth_accounts WHERE provider = ? AND subject = ? LIMIT 1",
    [OIDC_PROVIDER, subject],
  );
  if (!confirmed) throw new Error("Não foi possível vincular a conta.");
  return String(confirmed.user_id);
}

export async function completeOidcLogin(
  code: string,
  state: string,
): Promise<{ userId: string; nextPath: string }> {
  const stored = await consumeState(state);
  const { idToken } = await exchangeCode(code, stored.code_verifier);
  const claims = await verifyIdToken(idToken, stored.nonce);

  const subject = typeof claims.sub === "string" ? claims.sub : "";
  const email =
    typeof claims.email === "string" ? claims.email.trim().toLowerCase() : "";
  const name = typeof claims.name === "string" ? claims.name.trim() : "";
  if (!subject || !email) {
    throw new Error("OIDC não retornou sub/email.");
  }

  const userId = await findOrCreateUser(subject, email, name);
  return { userId, nextPath: safeNext(stored.next_path) };
}

export async function createLoginTicket(
  userId: string,
  nextPath: string,
): Promise<string> {
  const ticket = generateToken();
  const now = new Date();
  const expires = new Date(now.getTime() + 5 * 60_000);
  await execute("DELETE FROM login_tickets WHERE expires_at < ?", [now.toISOString()]);
  await execute(
    `INSERT INTO login_tickets (ticket_hash, user_id, next_path, created_at, expires_at, used_at)
     VALUES (?,?,?,?,?,?)`,
    [
      hashToken(ticket),
      userId,
      safeNext(nextPath),
      now.toISOString(),
      expires.toISOString(),
      null,
    ],
  );
  return ticket;
}

export async function consumeLoginTicket(
  ticket: string,
): Promise<{ userId: string; nextPath: string }> {
  const hash = hashToken(ticket);
  const row = await queryOne<{
    user_id: string;
    next_path: string;
    expires_at: string;
    used_at: string | null;
  }>(
    "SELECT user_id, next_path, expires_at, used_at FROM login_tickets WHERE ticket_hash = ? LIMIT 1",
    [hash],
  );
  if (!row || row.used_at || new Date(row.expires_at).getTime() <= Date.now()) {
    throw new Error("Ticket de login inválido.");
  }
  await execute("UPDATE login_tickets SET used_at = ? WHERE ticket_hash = ?", [
    nowIso(),
    hash,
  ]);
  return { userId: String(row.user_id), nextPath: safeNext(row.next_path) };
}

export function oidcCompleteUrl(ticket: string): string {
  const url = new URL(`${siteUrl()}/auth/oidc/complete`);
  url.searchParams.set("ticket", ticket);
  return url.toString();
}
