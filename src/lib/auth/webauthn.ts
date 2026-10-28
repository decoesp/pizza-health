import "server-only";
import { cookies } from "next/headers";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { execute, newId, nowIso, query, queryOne } from "@/lib/db";
import { generateToken, hashToken } from "@/lib/auth/password";
import { getEnv, webauthnOrigin, webauthnRpId } from "@/lib/env";

const REG_COOKIE = "ph_wa_reg";
const AUTH_COOKIE = "ph_wa_auth";

type ChallengeKind = "register" | "authenticate";

export type PasskeySummary = {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
  deviceType: string;
  backedUp: boolean;
};

type CredentialRow = {
  id: string;
  user_id: string;
  credential_id: string;
  public_key: string;
  counter: number;
  transports: string | null;
  device_type: string | null;
  backed_up: number;
  name: string | null;
  created_at: string;
  last_used_at: string | null;
};

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

async function setChallenge(
  userId: string | null,
  kind: ChallengeKind,
  challenge: string,
): Promise<void> {
  const id = generateToken();
  const now = new Date();
  const expires = new Date(now.getTime() + 5 * 60_000);
  await execute("DELETE FROM webauthn_challenges WHERE expires_at < ?", [
    now.toISOString(),
  ]);
  await execute(
    `INSERT INTO webauthn_challenges (id_hash, user_id, kind, challenge, created_at, expires_at)
     VALUES (?,?,?,?,?,?)`,
    [
      hashToken(id),
      userId,
      kind,
      challenge,
      now.toISOString(),
      expires.toISOString(),
    ],
  );
  const jar = await cookies();
  jar.set(kind === "register" ? REG_COOKIE : AUTH_COOKIE, id, cookieOptions(300));
}

async function takeChallenge(kind: ChallengeKind): Promise<string> {
  const jar = await cookies();
  const cookieName = kind === "register" ? REG_COOKIE : AUTH_COOKIE;
  const id = jar.get(cookieName)?.value;
  jar.set(cookieName, "", { ...cookieOptions(0), maxAge: 0 });
  if (!id) throw new Error("Desafio WebAuthn ausente.");
  const idHash = hashToken(id);
  const row = await queryOne<{
    challenge: string;
    kind: string;
    expires_at: string;
  }>(
    "SELECT challenge, kind, expires_at FROM webauthn_challenges WHERE id_hash = ? LIMIT 1",
    [idHash],
  );
  await execute("DELETE FROM webauthn_challenges WHERE id_hash = ?", [idHash]);
  if (!row || row.kind !== kind) throw new Error("Desafio WebAuthn inválido.");
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    throw new Error("Desafio WebAuthn expirado.");
  }
  return String(row.challenge);
}

function parseTransports(value: string | null): AuthenticatorTransportFuture[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is AuthenticatorTransportFuture =>
      typeof item === "string",
    );
  } catch {
    return [];
  }
}

export async function listPasskeys(userId: string): Promise<PasskeySummary[]> {
  const rows = await query<CredentialRow>(
    "SELECT * FROM webauthn_credentials WHERE user_id = ? ORDER BY created_at DESC",
    [userId],
  );
  return rows.map((row) => ({
    id: String(row.id),
    name: row.name ? String(row.name) : "Passkey",
    createdAt: String(row.created_at),
    lastUsedAt: row.last_used_at ? String(row.last_used_at) : null,
    deviceType: row.device_type ? String(row.device_type) : "singleDevice",
    backedUp: Number(row.backed_up) === 1,
  }));
}

export async function countPasskeys(userId: string): Promise<number> {
  const rows = await query<{ total: unknown }>(
    "SELECT COUNT(*) AS total FROM webauthn_credentials WHERE user_id = ?",
    [userId],
  );
  return Number(rows[0]?.total ?? 0);
}

export async function registrationOptions(user: {
  id: string;
  name: string;
  email: string;
}): Promise<Awaited<ReturnType<typeof generateRegistrationOptions>>> {
  const env = getEnv();
  const existing = await query<CredentialRow>(
    "SELECT * FROM webauthn_credentials WHERE user_id = ?",
    [user.id],
  );
  const options = await generateRegistrationOptions({
    rpName: env.WEBAUTHN_RP_NAME,
    rpID: webauthnRpId(),
    userID: new TextEncoder().encode(user.id),
    userName: user.email,
    userDisplayName: user.name,
    attestationType: "none",
    excludeCredentials: existing.map((row) => ({
      id: String(row.credential_id),
      transports: parseTransports(row.transports),
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });
  await setChallenge(user.id, "register", options.challenge);
  return options;
}

export async function verifyRegistration(
  userId: string,
  response: RegistrationResponseJSON,
  name: string,
): Promise<void> {
  const challenge = await takeChallenge("register");
  const result = await verifyRegistrationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: webauthnOrigin(),
    expectedRPID: webauthnRpId(),
    requireUserVerification: true,
  });
  if (!result.verified) throw new Error("Passkey não verificada.");

  const { credential, credentialDeviceType, credentialBackedUp } =
    result.registrationInfo;
  const now = nowIso();
  const label = name.trim().slice(0, 60) || "Passkey";
  await execute(
    `INSERT INTO webauthn_credentials
      (id, user_id, credential_id, public_key, counter, transports, device_type, backed_up, name, created_at, last_used_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [
      newId("pky"),
      userId,
      credential.id,
      Buffer.from(credential.publicKey).toString("base64url"),
      Number(credential.counter ?? 0),
      JSON.stringify(credential.transports ?? []),
      credentialDeviceType,
      credentialBackedUp ? 1 : 0,
      label,
      now,
      null,
    ],
  );
}

export async function authenticationOptions(
  email?: string,
): Promise<Awaited<ReturnType<typeof generateAuthenticationOptions>>> {
  const normalized = email?.trim().toLowerCase();
  let userId: string | null = null;
  let allowCredentials: Array<{
    id: string;
    transports: AuthenticatorTransportFuture[];
  }> = [];

  if (normalized) {
    const user = await queryOne<{ id: string }>(
      "SELECT id FROM users WHERE email = ? AND deleted_at IS NULL LIMIT 1",
      [normalized],
    );
    if (user) {
      userId = String(user.id);
      const credentials = await query<CredentialRow>(
        "SELECT * FROM webauthn_credentials WHERE user_id = ?",
        [userId],
      );
      allowCredentials = credentials.map((row) => ({
        id: String(row.credential_id),
        transports: parseTransports(row.transports),
      }));
    }
  }

  const options = await generateAuthenticationOptions({
    rpID: webauthnRpId(),
    allowCredentials,
    userVerification: "preferred",
  });
  await setChallenge(userId, "authenticate", options.challenge);
  return options;
}

export async function verifyAuthentication(
  response: AuthenticationResponseJSON,
): Promise<string> {
  const challenge = await takeChallenge("authenticate");
  const row = await queryOne<CredentialRow>(
    "SELECT * FROM webauthn_credentials WHERE credential_id = ? LIMIT 1",
    [response.id],
  );
  if (!row) throw new Error("Passkey desconhecida.");

  const result = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: webauthnOrigin(),
    expectedRPID: webauthnRpId(),
    credential: {
      id: String(row.credential_id),
      publicKey: Buffer.from(String(row.public_key), "base64url"),
      counter: Number(row.counter ?? 0),
      transports: parseTransports(row.transports),
    },
    requireUserVerification: true,
  });
  if (!result.verified) throw new Error("Passkey não verificada.");

  await execute(
    "UPDATE webauthn_credentials SET counter = ?, last_used_at = ? WHERE id = ? AND user_id = ?",
    [
      Number(result.authenticationInfo.newCounter ?? 0),
      nowIso(),
      String(row.id),
      String(row.user_id),
    ],
  );
  return String(row.user_id);
}

export async function deletePasskey(
  userId: string,
  passkeyId: string,
): Promise<boolean> {
  const result = await execute(
    "DELETE FROM webauthn_credentials WHERE id = ? AND user_id = ?",
    [passkeyId, userId],
  );
  return result.rowsAffected > 0;
}
