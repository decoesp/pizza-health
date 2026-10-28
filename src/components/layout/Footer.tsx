import Link from "next/link";
import { Logo } from "@/components/layout/Logo";

export function Footer() {
  return (
    <footer className="border-t border-line bg-surface/70">
      <div className="container-page flex flex-col gap-4 py-8 text-sm text-muted md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Logo href="/" />
        </div>
        <nav aria-label="Links institucionais" className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/privacidade" className="hover:text-tomato">
            Privacidade
          </Link>
          <Link href="/termos" className="hover:text-tomato">
            Termos
          </Link>
          <Link href="/seguranca" className="hover:text-tomato">
            Segurança
          </Link>
        </nav>
        <p className="max-w-md text-xs leading-relaxed">
          Pizza Health organiza informações de bem-estar. Não substitui avaliação
          médica, diagnóstico ou orientação profissional.
        </p>
      </div>
    </footer>
  );
}
