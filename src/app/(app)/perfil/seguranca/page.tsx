import type { Metadata } from "next";
import Link from "next/link";
import { requireUser, countActiveSessions, listActiveSessions } from "@/lib/auth/session";
import { Card, Field, Input, Notice, PageHeader } from "@/components/ui/Primitives";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { changePasswordAction, logoutAllAction } from "@/actions/auth";
import { formatDateTime } from "@/lib/domain/dates";

export const metadata: Metadata = { title: "Segurança" };
export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  const user = await requireUser("/perfil/seguranca");
  const [sessions, count] = await Promise.all([
    listActiveSessions(user.id),
    countActiveSessions(user.id),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Sua conta"
        title="Segurança"
        description="Senha, sessões ativas e encerramento remoto. Em caso de suspeita, troque a senha e encerre tudo."
        action={
          <Link href="/perfil" className="text-sm font-semibold text-tomato hover:underline">
            Voltar ao perfil
          </Link>
        }
      />

      <div className="space-y-6">
        <Card className="p-5">
          <h2 className="text-base font-semibold">Trocar senha</h2>
          <p className="mt-1 text-xs text-muted">
            A nova senha precisa ter pelo menos 10 caracteres, com letra e número.
            As outras sessões serão encerradas.
          </p>
          <ActionForm action={changePasswordAction} className="mt-3 space-y-3">
            <Field label="Senha atual" htmlFor="current-password">
              <Input id="current-password" name="current" type="password" autoComplete="current-password" required />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nova senha" htmlFor="new-password">
                <Input id="new-password" name="password" type="password" autoComplete="new-password" minLength={10} required />
              </Field>
              <Field label="Confirmar nova senha" htmlFor="confirm-password">
                <Input id="confirm-password" name="confirm" type="password" autoComplete="new-password" minLength={10} required />
              </Field>
            </div>
            <SubmitButton pendingLabel="Atualizando…">Atualizar senha</SubmitButton>
          </ActionForm>
        </Card>

        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Sessões ativas</h2>
              <p className="text-xs text-muted">
                {count} sessão{count === 1 ? "" : "s"} ativa{count === 1 ? "" : "s"} nesta conta.
              </p>
            </div>
            <form action={logoutAllAction}>
              <SubmitButton size="sm" variant="danger" pendingLabel="Encerrando…">
                Encerrar todas
              </SubmitButton>
            </form>
          </div>
          <ul className="mt-4 divide-y divide-line">
            {sessions.map((session, index) => (
              <li key={`${session.createdAt}-${index}`} className="py-2.5 text-sm">
                <p className="truncate font-medium">{session.userAgent}</p>
                <p className="text-xs text-muted">
                  iniciada em {formatDateTime(session.createdAt)} · expira em{" "}
                  {formatDateTime(session.expiresAt)}
                </p>
              </li>
            ))}
          </ul>
          {sessions.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Nenhuma sessão ativa encontrada.</p>
          ) : null}
        </Card>

        <Notice tone="info">
          Sessões são guardadas como hash de token. O cookie é httpOnly, SameSite=Lax
          e Secure em produção. Não compartilhe o navegador autenticado.
        </Notice>

        <Card className="p-5">
          <h2 className="text-base font-semibold">Excluir conta</h2>
          <p className="mt-1 text-sm text-muted">
            A exclusão remove dados pessoais, documentos, hábitos e publicações. É
            definitiva e não pode ser desfeita.
          </p>
          <div className="mt-3">
            <Link
              href="/perfil/dados"
              className="inline-flex items-center rounded-full bg-[#9c2f22] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#7f251b]"
            >
              Ir para exclusão de conta
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
