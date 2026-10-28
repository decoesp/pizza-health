import type { Metadata } from "next";
import { resetPasswordAction } from "@/actions/auth";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Field, Input, Notice } from "@/components/ui/Primitives";
import { hashToken } from "@/lib/auth/password";
import { isExpired } from "@/lib/domain/dates";
import { queryOne } from "@/lib/db";

export const metadata: Metadata = { title: "Redefinir senha" };

export default async function ResetPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const row = token
    ? await queryOne<{ expires_at: string; used_at: string | null }>(
        "SELECT expires_at, used_at FROM password_resets WHERE token_hash = ? LIMIT 1",
        [hashToken(token)],
      )
    : null;
  const valid = Boolean(row && !row.used_at && !isExpired(row.expires_at));

  return (
    <div className="container-page max-w-2xl py-12 lg:py-20">
      <p className="text-xs font-bold tracking-[0.18em] text-tomato uppercase">
        Redefinir senha
      </p>
      <h1 className="mt-3 text-3xl font-semibold">Escolha uma nova senha</h1>

      {!valid ? (
        <div className="mt-6">
          <Notice tone="error">
            Este link é inválido ou expirou. Solicite uma nova redefinição.
          </Notice>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-line bg-surface p-6">
          <ActionForm action={resetPasswordAction} className="space-y-4">
            <input type="hidden" name="token" value={token} />
            <Field label="Nova senha" htmlFor="password" hint="Mínimo de 10 caracteres, com letra e número.">
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={10}
              />
            </Field>
            <Field label="Confirmar nova senha" htmlFor="confirm">
              <Input
                id="confirm"
                name="confirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={10}
              />
            </Field>
            <SubmitButton pendingLabel="Atualizando…">Atualizar senha</SubmitButton>
          </ActionForm>
        </div>
      )}
    </div>
  );
}
