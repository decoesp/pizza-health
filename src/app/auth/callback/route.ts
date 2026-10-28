import { NextResponse } from "next/server";
import {
  completeOidcLogin,
  createLoginTicket,
  oidcCompleteUrl,
} from "@/lib/auth/oidc";
import { siteUrl } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function noStore(response: NextResponse): NextResponse {
  response.headers.set("cache-control", "no-store");
  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const providerError = url.searchParams.get("error");

  if (providerError || !code || !state) {
    console.error("[oidc] callback recusado pelo provedor.");
    return noStore(NextResponse.redirect(new URL("/entrar?erro=oidc", siteUrl())));
  }

  try {
    const { userId, nextPath } = await completeOidcLogin(code, state);
    const ticket = await createLoginTicket(userId, nextPath);
    return noStore(NextResponse.redirect(oidcCompleteUrl(ticket)));
  } catch (error) {
    console.error(
      "[oidc] callback falhou:",
      error instanceof Error ? error.message : "erro desconhecido",
    );
    return noStore(NextResponse.redirect(new URL("/entrar?erro=oidc", siteUrl())));
  }
}
