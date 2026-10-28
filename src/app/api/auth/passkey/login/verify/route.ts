import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { safeNext } from "@/lib/auth/oidc";
import { touchLastLogin } from "@/lib/auth/provision";
import { createSession } from "@/lib/auth/session";
import { verifyAuthentication } from "@/lib/auth/webauthn";
import { rateLimit, resetRateLimit } from "@/lib/auth/rate-limit";
import { recordAudit } from "@/lib/audit";
import { requestIpHash } from "@/lib/request-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const ipHash = await requestIpHash();
  const limit = rateLimit(`passkey:login:${ipHash}`, 20, 10 * 60_000);
  if (!limit.ok) {
    return Response.json(
      { error: "Muitas tentativas. Aguarde alguns minutos." },
      { status: 429 },
    );
  }

  try {
    const body = (await request.json()) as {
      response?: AuthenticationResponseJSON;
      next?: unknown;
    };
    if (!body.response || typeof body.response !== "object") {
      return Response.json({ error: "Resposta inválida." }, { status: 400 });
    }
    const userId = await verifyAuthentication(body.response);
    resetRateLimit(`passkey:login:${ipHash}`);
    await touchLastLogin(userId);
    await createSession(userId);
    await recordAudit({
      actorId: userId,
      action: "user.login_passkey",
      entityType: "user",
      entityId: userId,
    });
    return Response.json(
      { ok: true, redirect: safeNext(body.next) },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error(
      "[passkey] login falhou:",
      error instanceof Error ? error.message : "erro desconhecido",
    );
    return Response.json(
      { error: "Passkey inválida ou expirada. Tente novamente." },
      { status: 400 },
    );
  }
}
