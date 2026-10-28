import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { query } from "@/lib/db";
import { Card, Field, Input, Notice, PageHeader } from "@/components/ui/Primitives";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { requestDeletionAction, requestExportAction } from "@/actions/profile";
import { formatDateTime } from "@/lib/domain/dates";

export const metadata: Metadata = { title: "Seus dados" };
export const dynamic = "force-dynamic";

export default async function DataPage() {
  const user = await requireUser("/perfil/dados");
  const requests = await query<{
    id: string;
    kind: string;
    status: string;
    created_at: string;
  }>(
    "SELECT id, kind, status, created_at FROM data_requests WHERE user_id = ? ORDER BY created_at DESC LIMIT 20",
    [user.id],
  );

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="LGPD e transparência"
        title="Seus dados"
        description="Exporte uma cópia, acompanhe solicitações ou exclua a conta. Sem letras miúdas escondidas."
        action={
          <Link href="/perfil" className="text-sm font-semibold text-tomato hover:underline">
            Voltar ao perfil
          </Link>
        }
      />

      <div className="space-y-6">
        <Card className="p-5">
          <h2 className="text-base font-semibold">Exportar dados</h2>
          <p className="mt-1 text-sm text-muted">
            Geramos um JSON com perfil, comunidades, hábitos, metas, publicações,
            documentos (metadados), exames, vacinas, pontos, conquistas e
            notificações. Senhas, tokens de sessão e hashes de IP não são exportados.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <ActionForm action={requestExportAction}>
              <SubmitButton pendingLabel="Preparando…">Preparar exportação</SubmitButton>
            </ActionForm>
            <a
              href="/api/export?files=1"
              className="inline-flex items-center rounded-full border border-line-strong bg-surface px-4 py-2.5 text-sm font-semibold hover:bg-surface-soft"
            >
              Baixar com arquivos (até 20 MB)
            </a>
          </div>
          <p className="mt-3 text-xs text-muted">
            O pacote com arquivos inclui o conteúdo decriptado dos documentos. Guarde
            em local seguro; ele contém dados sensíveis.
          </p>
        </Card>

        <Card className="p-5">
          <h2 className="text-base font-semibold">Histórico de solicitações</h2>
          {requests.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Nenhuma solicitação registrada.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {requests.map((request) => (
                <li key={request.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <span>
                    {request.kind === "delete" ? "Exclusão de conta" : "Exportação"} ·{" "}
                    <span className="text-muted">{formatDateTime(request.created_at)}</span>
                  </span>
                  <span className="rounded-full bg-paper-deep px-2.5 py-1 text-[0.65rem] font-semibold text-ink-soft">
                    {request.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="border-tomato/30 p-5">
          <h2 className="text-base font-semibold text-tomato-deep">Excluir conta</h2>
          <p className="mt-1 text-sm text-ink-soft">
            A exclusão é definitiva. Removemos perfil, hábitos, metas, publicações,
            comentários, reações, documentos criptografados, exames, vacinas, pontos
            e conquistas. Comunidades das quais você é proprietário são transferidas
            para a pessoa mais antiga ou arquivadas se não houver outra. Registros de
            auditoria são mantidos de forma minimizada, sem o seu identificador.
          </p>
          <div className="mt-3">
            <Notice tone="warning">
              Se você participa de desafios ou comunidades, avise a turma. A exclusão
              não pode ser desfeita.
            </Notice>
          </div>
          <ActionForm action={requestDeletionAction} className="mt-4 space-y-3">
            <Field label="Senha atual" htmlFor="delete-password">
              <Input id="delete-password" name="password" type="password" autoComplete="current-password" required />
            </Field>
            <Field label='Digite "EXCLUIR" para confirmar' htmlFor="delete-confirm">
              <Input id="delete-confirm" name="confirmation" required placeholder="EXCLUIR" />
            </Field>
            <SubmitButton variant="danger" pendingLabel="Excluindo…">
              Excluir minha conta definitivamente
            </SubmitButton>
          </ActionForm>
        </Card>

        <Card className="p-5">
          <h2 className="text-base font-semibold">Seus direitos</h2>
          <ul className="mt-2 space-y-1.5 text-sm text-ink-soft">
            <li>Confirmação da existência de tratamento e acesso aos dados.</li>
            <li>Correção de dados incompletos ou desatualizados.</li>
            <li>Revogação de consentimentos e compartilhamentos.</li>
            <li>Portabilidade por exportação em formato aberto.</li>
            <li>Eliminação de dados tratados com consentimento, ressalvadas obrigações legais.</li>
          </ul>
          <p className="mt-3 text-xs text-muted">
            A avaliação jurídica específica da instância e do contrato de dados deve
            ser feita pelo operador antes de um lançamento público.
          </p>
        </Card>
      </div>
    </div>
  );
}
