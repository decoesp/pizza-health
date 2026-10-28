import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { loginAction } from "@/actions/auth";
import { oidcConfigured } from "@/lib/env";
import { PasskeyLogin } from "@/components/auth/PasskeyLogin";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Field, Input, Notice } from "@/components/ui/Primitives";
import { PizzaMark } from "@/components/layout/Logo";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; redefinida?: string; encerradas?: string; erro?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/inicio");
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/inicio";
  const pizzaAuth = oidcConfigured();

  return (
    <div className="container-page grid gap-10 py-12 lg:grid-cols-[1fr_460px] lg:items-center lg:py-20">
      <section className="hidden lg:block">
        <p className="text-xs font-bold tracking-[0.18em] text-tomato uppercase">
          Pizza Health
        </p>
        <h1 className="mt-3 max-w-xl text-4xl font-semibold leading-[1.08]">
          Cuidar de você fica mais leve quando a turma cuida junto.
        </h1>
        <p className="mt-4 max-w-lg text-ink-soft">
          Seu diário de hábitos, seus exames organizados e uma comunidade privada
          que incentiva sem cobrar perfeição.
        </p>
        <div className="mt-8 grid max-w-md grid-cols-2 gap-3 text-sm">
          {[
            ["Privacidade por padrão", "Você escolhe o que compartilhar."],
            ["Ranking de hábitos", "Nunca de exames ou diagnósticos."],
            ["Documentos protegidos", "Criptografados e com acesso controlado."],
            ["Cuidado coletivo", "Desafios e incentivo entre amigos."],
          ].map(([title, description]) => (
            <div key={title} className="rounded-xl border border-line bg-surface/70 p-3">
              <p className="font-semibold">{title}</p>
              <p className="mt-1 text-xs text-muted">{description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-md rounded-3xl border border-line bg-surface p-6 shadow-[0_18px_40px_-30px_rgba(36,31,27,0.45)] sm:p-8">
        <div className="mb-6 flex items-center gap-3 lg:hidden">
          <PizzaMark size={38} />
          <div>
            <p className="font-semibold">Pizza Health</p>
            <p className="text-xs text-muted">cuidar junto</p>
          </div>
        </div>
        <h2 className="text-2xl font-semibold">Bem-vindo de volta</h2>
        <p className="mt-1 text-sm text-muted">
          Entre para acompanhar seus hábitos e sua comunidade.
        </p>

        {params.redefinida ? (
          <div className="mt-4">
            <Notice tone="success">Senha redefinida. Entre com a nova senha.</Notice>
          </div>
        ) : null}
        {params.encerradas ? (
          <div className="mt-4">
            <Notice tone="info">Todas as sessões foram encerradas. Entre novamente.</Notice>
          </div>
        ) : null}
        {params.erro === "oidc" ? (
          <div className="mt-4">
            <Notice tone="warning">
              Não foi possível concluir o login com Pizza Auth. Tente novamente ou
              entre com e-mail e senha.
            </Notice>
          </div>
        ) : null}
        {params.erro === "termos" ? (
          <div className="mt-4">
            <Notice tone="warning">
              Para entrar com Pizza Auth, aceite os termos e a política de
              privacidade.
            </Notice>
          </div>
        ) : null}

        {pizzaAuth ? (
          <form action="/auth/oidc/start" method="get" className="mt-5 space-y-3">
            <input type="hidden" name="next" value={next} />
            <label className="flex items-start gap-2 text-xs text-muted">
              <input
                type="checkbox"
                name="accept"
                value="1"
                required
                className="mt-0.5 h-4 w-4 rounded border-line accent-[#C2410C]"
              />
              <span>
                Li e aceito os{" "}
                <Link href="/termos" className="font-semibold text-tomato hover:underline">
                  termos
                </Link>{" "}
                e a{" "}
                <Link href="/privacidade" className="font-semibold text-tomato hover:underline">
                  política de privacidade
                </Link>
                .
              </span>
            </label>
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-paper hover:bg-ink-soft"
            >
              <span aria-hidden>🍕</span>
              Entrar com Pizza Auth
            </button>
          </form>
        ) : null}

        {pizzaAuth ? (
          <div className="my-5 flex items-center gap-3 text-[0.7rem] font-semibold tracking-wide text-muted uppercase">
            <span className="h-px flex-1 bg-line" />
            ou com e-mail e senha
            <span className="h-px flex-1 bg-line" />
          </div>
        ) : null}

        <ActionForm action={loginAction} className="mt-5 space-y-4">
          <input type="hidden" name="next" value={next} />
          <Field label="E-mail" htmlFor="email">
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="voce@exemplo.com"
            />
          </Field>
          <Field
            label="Senha"
            htmlFor="password"
            hint={
              <Link href="/recuperar" className="text-tomato hover:underline">
                Esqueci minha senha
              </Link>
            }
          >
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>
          <SubmitButton className="w-full" pendingLabel="Entrando…">
            Entrar
          </SubmitButton>
        </ActionForm>

        <PasskeyLogin next={next} />

        <p className="mt-5 text-center text-sm text-muted">
          Ainda não tem conta?{" "}
          <Link href={`/criar-conta?next=${encodeURIComponent(next)}`} className="font-semibold text-tomato hover:underline">
            Criar agora
          </Link>
        </p>

        {process.env.NODE_ENV !== "production" && process.env.SEED_DEMO === "1" ? (
          <div className="mt-5 rounded-xl border border-line bg-surface-soft p-3 text-xs text-muted">
            <p className="font-semibold text-ink-soft">Conta de demonstração</p>
            <p className="mt-1 font-mono">ana@pizzahealth.app</p>
            <p className="font-mono">pizza-health-demo-2026</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
