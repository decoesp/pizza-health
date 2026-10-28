import { getCurrentUser } from "@/lib/auth/session";
import { countPasskeys, registrationOptions } from "@/lib/auth/webauthn";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
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
    const options = await registrationOptions(user);
    return Response.json(options, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    console.error(
      "[passkey] opções de cadastro falharam:",
      error instanceof Error ? error.message : "erro desconhecido",
    );
    return Response.json({ error: "Não foi possível iniciar o cadastro." }, { status: 500 });
  }
}
