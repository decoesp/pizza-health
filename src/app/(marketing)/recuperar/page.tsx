import type { Metadata } from "next";
import Link from "next/link";
import { requestPasswordResetAction } from "@/actions/auth";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Field, Input } from "@/components/ui/Primitives";

export const metadata: Metadata = { title: "Recuperar acesso" };

export default function RecoverPage() {
  return (
    <div className="container-page max-w-2xl py-12 lg:py-20">
      <p className="text-xs font-bold tracking-[0.18em] text-tomato uppercase">
        Recuperar acesso
      </p>
      <h1 className="mt-3 text-3xl font-semibold">Não consegue entrar?</h1>
      <p className="mt-3 max-w-xl text-ink-soft">
        Informe o e-mail da conta. Por segurança, a resposta é sempre a mesma,
        exista ou não uma conta com esse endereço.
      </p>

      <div className="mt-8 rounded-2xl border border-line bg-surface p-6">
        <ActionForm action={requestPasswordResetAction} className="space-y-4">
          <Field label="E-mail da conta" htmlFor="email">
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </Field>
          <SubmitButton pendingLabel="Registrando…">Solicitar redefinição</SubmitButton>
        </ActionForm>
        <p className="mt-4 text-xs text-muted">
          Neste ambiente o envio automático de e-mail não está configurado. Um
          administrador pode gerar um link de redefinição de uso único, válido por
          1 hora. O link nunca é armazenado em texto puro.
        </p>
      </div>

      <p className="mt-6 text-sm">
        <Link href="/entrar" className="font-semibold text-tomato hover:underline">
          Voltar para o login
        </Link>
      </p>
    </div>
  );
}
