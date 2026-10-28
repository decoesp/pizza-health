import { authenticationOptions } from "@/lib/auth/webauthn";
import { rateLimit } from "@/lib/auth/rate-limit";
import { requestIpHash } from "@/lib/request-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const ipHash = await requestIpHash();
  const limit = rateLimit(`passkey:options:${ipHash}`, 30, 10 * 60_000);
  if (!limit.ok) {
    return Response.json(
      { error: "Muitas tentativas. Aguarde alguns minutos." },
      { status: 429 },
    );
  }

  let email: string | undefined;
  try {
    const body = (await request.json()) as { email?: unknown };
    if (typeof body.email === "string" && body.email.trim()) {
      email = body.email.trim().slice(0, 200);
    }
  } catch {
    // Sem corpo: fluxo com credencial descobrível.
  }

  try {
    const options = await authenticationOptions(email);
    return Response.json(options, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    console.error(
      "[passkey] opções de login falharam:",
      error instanceof Error ? error.message : "erro desconhecido",
    );
    return Response.json(
      { error: "Não foi possível iniciar o login com passkey." },
      { status: 500 },
    );
  }
}
