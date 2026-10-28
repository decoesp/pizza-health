import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { getCurrentUser } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import {
  countPasskeys,
  verifyRegistration,
} from "@/lib/auth/webauthn";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Entre para cadastrar uma passkey." }, { status: 401 });
  }
  if ((await countPasskeys(user.id)) >= 10) {
    return Response.json(
      { error: "Limite de 10 passkeys por conta." },
      { status: 400 },
    );
  }
  try {
    const body = (await request.json()) as {
      response?: RegistrationResponseJSON;
      name?: unknown;
    };
    if (!body.response || typeof body.response !== "object") {
      return Response.json({ error: "Resposta inválida." }, { status: 400 });
    }
    const name = typeof body.name === "string" ? body.name : "";
    await verifyRegistration(user.id, body.response, name);
    await recordAudit({
      actorId: user.id,
      action: "passkey.register",
      entityType: "webauthn_credential",
    });
    return Response.json(
      { ok: true },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error(
      "[passkey] cadastro falhou:",
      error instanceof Error ? error.message : "erro desconhecido",
    );
    return Response.json(
      { error: "Não foi possível validar a passkey. Tente novamente." },
      { status: 400 },
    );
  }
}
