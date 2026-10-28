import type { ReactNode } from "react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { Logo } from "@/components/layout/Logo";
import { Footer } from "@/components/layout/Footer";
import { ButtonLink } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

export default async function MarketingLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line bg-paper/85 backdrop-blur">
        <div className="container-page flex items-center justify-between gap-4 py-3.5">
          <Logo href="/" />
          <nav aria-label="Conta" className="flex items-center gap-2">
            {user ? (
              <ButtonLink href="/inicio" size="sm">
                Ir para o app
              </ButtonLink>
            ) : (
              <>
                <Link
                  href="/entrar"
                  className="rounded-full px-3 py-2 text-sm font-semibold text-ink-soft hover:bg-paper-deep"
                >
                  Entrar
                </Link>
                <ButtonLink href="/criar-conta" size="sm">
                  Criar conta
                </ButtonLink>
              </>
            )}
          </nav>
        </div>
      </header>
      <main id="conteudo" className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}
