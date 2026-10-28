import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/session";
import { listDataRequests, listResetRequests } from "@/lib/data/admin";
import { Badge, Card, EmptyState, Field, Input, Notice, PageHeader } from "@/components/ui/Primitives";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { generateResetLinkAction, resolveDataRequestAction } from "@/actions/admin";
import { formatDateTime } from "@/lib/domain/dates";

export const metadata: Metadata = { title: "Administração" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin();
  const [resets, requests] = await Promise.all([listResetRequests(), listDataRequests()]);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow="Operação"
        title="Administração"
        description="Ferramentas de suporte. Administradores não têm acesso a exames, resultados ou documentos de membros."
      />

      <div className="space-y-6">
        <Notice tone="warning">
          Acesso restrito. Toda ação administrativa gera auditoria. Não copie dados
          clínicos para e-mails, mensagens ou ferramentas externas.
        </Notice>

        <Card className="p-5">
          <h2 className="text-base font-semibold">Gerar link de redefinição</h2>
          <p className="mt-1 text-xs text-muted">
            Link de uso único, válido por 1 hora, armazenado apenas como hash.
            Entregue por um canal seguro e confirme a identidade da pessoa.
          </p>
          <ActionForm action={generateResetLinkAction} className="mt-3 flex flex-wrap items-end gap-2">
            <div className="min-w-60 flex-1">
              <Field label="E-mail da conta" htmlFor="reset-email">
                <Input id="reset-email" name="email" type="email" required placeholder="pessoa@exemplo.com" />
              </Field>
            </div>
            <SubmitButton size="sm" pendingLabel="Gerando…">Gerar link</SubmitButton>
          </ActionForm>
        </Card>

        <Card className="p-5">
          <h2 className="text-base font-semibold">Pedidos de redefinição</h2>
          {resets.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Nenhum pedido ativo.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {resets.map((reset) => (
                <li key={`${reset.userId}-${reset.requestedAt}`} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <span>
                    {reset.name} · <span className="text-muted">{reset.email}</span>
                  </span>
                  <span className="text-xs text-muted">
                    pedido em {formatDateTime(reset.requestedAt)} · expira {formatDateTime(reset.expiresAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="text-base font-semibold">Solicitações de dados</h2>
          {requests.length === 0 ? (
            <EmptyState
              title="Nenhuma solicitação"
              description="Pedidos de exportação e exclusão aparecem aqui."
              icon="file"
            />
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {requests.map((request) => (
                <li key={request.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-medium">
                      {request.kind === "delete" ? "Exclusão" : "Exportação"} · {request.name}
                    </p>
                    <p className="text-xs text-muted">
                      {request.email} · {formatDateTime(request.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={request.status === "completed" ? "basil" : request.status === "rejected" ? "tomato" : "saffron"}>
                      {request.status}
                    </Badge>
                    {request.status === "pending" ? (
                      <>
                        <ActionForm action={resolveDataRequestAction} hideMessage>
                          <input type="hidden" name="requestId" value={request.id} />
                          <input type="hidden" name="status" value="completed" />
                          <SubmitButton size="sm" variant="secondary" pendingLabel="…">
                            Concluir
                          </SubmitButton>
                        </ActionForm>
                        <ActionForm action={resolveDataRequestAction} hideMessage>
                          <input type="hidden" name="requestId" value={request.id} />
                          <input type="hidden" name="status" value="rejected" />
                          <SubmitButton size="sm" variant="ghost" pendingLabel="…">
                            Rejeitar
                          </SubmitButton>
                        </ActionForm>
                      </>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="text-base font-semibold">Limites do papel administrativo</h2>
          <ul className="mt-2 space-y-1.5 text-xs text-muted">
            <li>Não abre documentos médicos de membros.</li>
            <li>Não altera resultados de exames.</li>
            <li>Não remove conteúdo de comunidade sem registro de moderação.</li>
            <li>Não recebe senhas em texto puro em nenhuma circunstância.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
