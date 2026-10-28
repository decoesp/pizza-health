import { NextResponse } from "next/server";
import { createAuthorizationUrl, safeNext } from "@/lib/auth/oidc";
import { oidcConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (!oidcConfigured()) {
    return NextResponse.redirect(new URL("/entrar?erro=oidc", url));
  }
  if (url.searchParams.get("accept") !== "1") {
    return NextResponse.redirect(new URL("/entrar?erro=termos", url));
  }
  try {
    const target = await createAuthorizationUrl(
      safeNext(url.searchParams.get("next")),
    );
    return NextResponse.redirect(target);
  } catch (error) {
    console.error(
      "[oidc] não foi possível iniciar:",
      error instanceof Error ? error.message : "erro desconhecido",
    );
    return NextResponse.redirect(new URL("/entrar?erro=oidc", url));
  }
}
