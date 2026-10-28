import { NextResponse } from "next/server";
import { consumeLoginTicket } from "@/lib/auth/oidc";
import { touchLastLogin } from "@/lib/auth/provision";
import { createSession, getCurrentUser } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function noStore(response: NextResponse): NextResponse {
  response.headers.set("cache-control", "no-store");
  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const ticket = url.searchParams.get("ticket");
  if (!ticket) {
    return noStore(NextResponse.redirect(new URL("/entrar?erro=oidc", url)));
  }

  try {
    const { userId, nextPath } = await consumeLoginTicket(ticket);
    const current = await getCurrentUser();
    if (current && current.id !== userId) {
      return noStore(NextResponse.redirect(new URL("/entrar?erro=oidc", url)));
    }
    await touchLastLogin(userId);
    await createSession(userId);
    await recordAudit({
      actorId: userId,
      action: "user.login_oidc",
      entityType: "user",
      entityId: userId,
    });
    return noStore(NextResponse.redirect(new URL(nextPath, url)));
  } catch (error) {
    console.error(
      "[oidc] conclusão falhou:",
      error instanceof Error ? error.message : "erro desconhecido",
    );
    return noStore(NextResponse.redirect(new URL("/entrar?erro=oidc", url)));
  }
}
