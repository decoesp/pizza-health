import "./setup-env";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { rmSync } from "node:fs";
import { after, before, describe, it } from "node:test";
import { SignJWT, exportJWK, generateKeyPair, type JWK } from "jose";
import { closeDb, queryOne } from "../src/lib/db";
import { migrate } from "../src/lib/db/migrate";
import { resetEnvForTests } from "../src/lib/env";
import * as oidc from "../src/lib/auth/oidc";

const ISSUER = "https://auth.test.local";
const CLIENT_ID = "pizza-healt";
const CLIENT_SECRET = "test-client-secret-with-enough-length";
const REDIRECT_URI = "http://localhost:3000/auth/callback";

process.env.LOCAL_DB_PATH = ".data/test-oidc.db";
process.env.OIDC_ISSUER = ISSUER;
process.env.OIDC_CLIENT_ID = CLIENT_ID;
process.env.OIDC_CLIENT_SECRET = CLIENT_SECRET;
process.env.OIDC_REDIRECT_URI = REDIRECT_URI;
process.env.OIDC_POST_LOGOUT_REDIRECT_URI = "http://localhost:3000";
resetEnvForTests();


let privateKey: CryptoKey;
let publicJwk: JWK;

type TokenRequest = {
  grant_type?: string;
  code?: string;
  code_verifier?: string;
  redirect_uri?: string;
  client_id?: string;
  client_secret?: string;
};

const tokenRequests: TokenRequest[] = [];
let nextNonce = "";
let nextAudience = CLIENT_ID;
let nextIssuer = ISSUER;

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

async function idToken(overrides: { nonce?: string; audience?: string; issuer?: string } = {}) {
  return new SignJWT({
    nonce: overrides.nonce ?? nextNonce,
    email: "oidc-user@test.local",
    name: "Pessoa OIDC",
  })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer(overrides.issuer ?? nextIssuer)
    .setAudience(overrides.audience ?? nextAudience)
    .setSubject("subject-123")
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(privateKey);
}

const fetchStub = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = String(input);
  if (url === `${ISSUER}/.well-known/openid-configuration`) {
    return json({
      issuer: ISSUER,
      authorization_endpoint: `${ISSUER}/authorize`,
      token_endpoint: `${ISSUER}/token`,
      userinfo_endpoint: `${ISSUER}/userinfo`,
      jwks_uri: `${ISSUER}/jwks.json`,
      end_session_endpoint: `${ISSUER}/logout`,
    });
  }
  if (url === `${ISSUER}/jwks.json`) {
    return json({ keys: [publicJwk] });
  }
  if (url === `${ISSUER}/token`) {
    const body = new URLSearchParams(String(init?.body ?? ""));
    const request: TokenRequest = {};
    for (const [key, value] of body.entries()) {
      request[key as keyof TokenRequest] = value;
    }
    tokenRequests.push(request);
    return json({ id_token: await idToken(), access_token: "access-token", token_type: "Bearer" });
  }
  throw new Error(`fetch inesperado: ${url}`);
};

before(async () => {
  for (const suffix of ["", "-shm", "-wal"]) {
    rmSync(`.data/test-oidc.db${suffix}`, { force: true });
  }
  await migrate();
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  publicJwk = { ...(await exportJWK(pair.publicKey)), kid: "test-key", alg: "RS256", use: "sig" };
  globalThis.fetch = fetchStub as typeof fetch;
});

after(() => {
  closeDb();
});

describe("Pizza Auth (OIDC)", () => {
  it("monta /authorize com PKCE S256, state, nonce e escopos", async () => {
    const url = new URL(await oidc.createAuthorizationUrl("/perfil/seguranca"));
    assert.equal(url.origin + url.pathname, `${ISSUER}/authorize`);
    assert.equal(url.searchParams.get("response_type"), "code");
    assert.equal(url.searchParams.get("client_id"), CLIENT_ID);
    assert.equal(url.searchParams.get("redirect_uri"), REDIRECT_URI);
    assert.equal(url.searchParams.get("scope"), "openid profile email offline_access");
    assert.equal(url.searchParams.get("code_challenge_method"), "S256");
    assert.ok((url.searchParams.get("code_challenge") ?? "").length >= 43);
    assert.ok((url.searchParams.get("state") ?? "").length >= 32);
    assert.ok((url.searchParams.get("nonce") ?? "").length >= 32);
  });

  it("troca o código com o verifier correto e provisiona a conta", async () => {
    const url = new URL(await oidc.createAuthorizationUrl("/inicio"));
    nextNonce = url.searchParams.get("nonce") ?? "";
    const challenge = url.searchParams.get("code_challenge") ?? "";

    const result = await oidc.completeOidcLogin("code-1", url.searchParams.get("state") ?? "");
    assert.equal(result.nextPath, "/inicio");

    const request = tokenRequests.at(-1);
    assert.ok(request);
    assert.equal(request.grant_type, "authorization_code");
    assert.equal(request.code, "code-1");
    assert.equal(request.redirect_uri, REDIRECT_URI);
    assert.equal(request.client_id, CLIENT_ID);
    assert.equal(request.client_secret, CLIENT_SECRET);
    assert.equal(
      createHash("sha256").update(String(request.code_verifier)).digest("base64url"),
      challenge,
    );

    const user = await queryOne<{ email: string; name: string }>(
      "SELECT email, name FROM users WHERE id = ? LIMIT 1",
      [result.userId],
    );
    assert.equal(user?.email, "oidc-user@test.local");
    assert.equal(user?.name, "Pessoa OIDC");

    const link = await queryOne<{ provider: string; subject: string }>(
      "SELECT provider, subject FROM oauth_accounts WHERE user_id = ? LIMIT 1",
      [result.userId],
    );
    assert.deepEqual({ ...link }, { provider: "pizza-auth", subject: "subject-123" });
  });

  it("reutiliza a conta existente no segundo login", async () => {
    const url = new URL(await oidc.createAuthorizationUrl("/inicio"));
    nextNonce = url.searchParams.get("nonce") ?? "";
    const first = await oidc.completeOidcLogin("code-2", url.searchParams.get("state") ?? "");
    const count = await queryOne<{ total: number }>(
      "SELECT COUNT(*) AS total FROM users WHERE email = ?",
      ["oidc-user@test.local"],
    );
    assert.equal(Number(count?.total), 1);
    assert.ok(first.userId);
  });

  it("rejeita state desconhecido e reutilização de state", async () => {
    await assert.rejects(() => oidc.completeOidcLogin("code", "state-inventado"), /Estado OIDC/);

    const url = new URL(await oidc.createAuthorizationUrl("/inicio"));
    const state = url.searchParams.get("state") ?? "";
    nextNonce = url.searchParams.get("nonce") ?? "";
    await oidc.completeOidcLogin("code-3", state);
    await assert.rejects(() => oidc.completeOidcLogin("code-3", state), /Estado OIDC/);
  });

  it("rejeita nonce divergente", async () => {
    const url = new URL(await oidc.createAuthorizationUrl("/inicio"));
    nextNonce = "nonce-errado";
    await assert.rejects(
      () => oidc.completeOidcLogin("code-4", url.searchParams.get("state") ?? ""),
      /Nonce OIDC inválido/,
    );
  });

  it("rejeita audience ou issuer divergentes", async () => {
    const wrongAudience = new URL(await oidc.createAuthorizationUrl("/inicio"));
    nextNonce = wrongAudience.searchParams.get("nonce") ?? "";
    nextAudience = "outro-cliente";
    await assert.rejects(
      () => oidc.completeOidcLogin("code-5", wrongAudience.searchParams.get("state") ?? ""),
    );
    nextAudience = CLIENT_ID;

    const wrongIssuer = new URL(await oidc.createAuthorizationUrl("/inicio"));
    nextNonce = wrongIssuer.searchParams.get("nonce") ?? "";
    nextIssuer = "https://auth.invasor.local";
    await assert.rejects(
      () => oidc.completeOidcLogin("code-6", wrongIssuer.searchParams.get("state") ?? ""),
    );
    nextIssuer = ISSUER;
  });

  it("sanitiza o destino e consome o ticket uma única vez", async () => {
    const user = await queryOne<{ id: string }>(
      "SELECT id FROM users WHERE email = ? LIMIT 1",
      ["oidc-user@test.local"],
    );
    const ticket = await oidc.createLoginTicket(String(user?.id), "//evil.example");
    const consumed = await oidc.consumeLoginTicket(ticket);
    assert.equal(consumed.nextPath, "/inicio");
    await assert.rejects(() => oidc.consumeLoginTicket(ticket), /Ticket de login inválido/);
  });
});
