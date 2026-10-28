import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { registerAction } from "@/actions/auth";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Checkbox, Field, Input } from "@/components/ui/Primitives";

export const metadata: Metadata = { title: "Criar conta" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/inicio");
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/inicio";

  return (
    <div className="container-page grid gap-10 py-12 lg:grid-cols-[1fr_500px] lg:items-center lg:py-20">
      <section className="hidden lg:block">
        <p className="text-xs font-bold tracking-[0.18em] text-tomato uppercase">
          Comece pelo essencial
        </p>
        <h1 className="mt-3 max-w-xl text-4xl font-semibold leading-[1.08]">
          Um espaço só seu, com a companhia de quem você confia.
        </h1>
        <p className="mt-4 max-w-lg text-ink-soft">
          Registre hábitos, organize exames e vacinas e participe de desafios.
          Você decide o que fica privado e o que a comunidade pode ver.
        </p>
        <ul className="mt-8 space-y-3 text-sm text-ink-soft">
          {[
            "Nenhum resultado de exame entra no feed automaticamente.",
            "O ranking mede constância, não estado clínico.",
            "Você pode exportar ou excluir seus dados quando quiser.",
          ].map((item) => (
            <li key={item} className="flex gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-tomato" />
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto w-full max-w-lg rounded-3xl border border-line bg-surface p-6 shadow-[0_18px_40px_-30px_rgba(36,31,27,0.45)] sm:p-8">
        <h2 className="text-2xl font-semibold">Criar sua conta</h2>
        <p className="mt-1 text-sm text-muted">
          Sua primeira comunidade privada é criada automaticamente.
        </p>

        <ActionForm action={registerAction} className="mt-5 space-y-4">
          <input type="hidden" name="next" value={next} />
          <Field label="Nome de exibição" htmlFor="name">
            <Input id="name" name="name" autoComplete="name" required maxLength={80} />
          </Field>
          <Field label="E-mail" htmlFor="email">
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Senha" htmlFor="password" hint="Mínimo de 10 caracteres, com letra e número.">
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={10}
              />
            </Field>
            <Field label="Confirmar senha" htmlFor="confirm">
              <Input
                id="confirm"
                name="confirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={10}
              />
            </Field>
          </div>
          <Checkbox
            name="ranking"
            label="Quero aparecer no ranking da comunidade"
            description="O ranking considera apenas hábitos registrados, desafios e participação. Você pode mudar isso depois."
          />
          <Checkbox
            name="accept"
            label="Aceito os termos e a política de privacidade"
            description="Tratamos dados de saúde com cuidado reforçado. Leia os detalhes antes de continuar."
            required
          />
          <SubmitButton className="w-full" pendingLabel="Criando conta…">
            Criar conta
          </SubmitButton>
        </ActionForm>

        <p className="mt-5 text-center text-sm text-muted">
          Já tem conta?{" "}
          <Link href={`/entrar?next=${encodeURIComponent(next)}`} className="font-semibold text-tomato hover:underline">
            Entrar
          </Link>
        </p>
        <p className="mt-4 text-center text-xs text-muted">
          Ao criar a conta você aceita os{" "}
          <Link href="/termos" className="underline">
            termos
          </Link>{" "}
          e a{" "}
          <Link href="/privacidade" className="underline">
            política de privacidade
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
