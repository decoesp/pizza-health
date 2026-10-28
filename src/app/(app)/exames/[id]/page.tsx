import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { canViewDocument } from "@/lib/authz";
import { getDocument, listDocumentShares } from "@/lib/data/documents";
import { listCommunitiesForUser } from "@/lib/data/communities";
import {
  Badge,
  Card,
  Field,
  Input,
  Notice,
  PageHeader,
  Select,
  Textarea,
} from "@/components/ui/Primitives";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { Icon } from "@/components/ui/Icon";
import {
  deleteDocumentAction,
  shareDocumentAction,
  unshareDocumentAction,
  updateDocumentAction,
} from "@/actions/documents";
import { formatBytes, isPreviewable } from "@/lib/crypto/documents";
import { formatDate, formatDateTime, todayIso } from "@/lib/domain/dates";

export const metadata: Metadata = { title: "Documento" };
export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; tone: "neutral" | "tomato" | "basil" | "saffron" | "sky" }> = {
  received: { label: "recebido", tone: "neutral" },
  processing: { label: "processando", tone: "sky" },
  awaiting_review: { label: "aguardando revisão", tone: "saffron" },
  confirmed: { label: "confirmado", tone: "basil" },
  failed: { label: "falhou", tone: "tomato" },
};

const CATEGORY: Record<string, string> = { exam: "Exame", vaccine: "Vacina", other: "Outro" };

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser("/exames");
  const { id } = await params;
  const allowed = await canViewDocument(user.id, id);
  if (!allowed) notFound();
  const document = await getDocument(id);
  if (!document) notFound();
  const owner = document.userId === user.id;
  const [shares, communities] = await Promise.all([
    listDocumentShares(id),
    owner ? listCommunitiesForUser(user.id) : Promise.resolve([]),
  ]);
  const status = STATUS[document.status] ?? { label: "recebido", tone: "neutral" as const };
  const sharedIds = new Set(shares.map((share) => share.communityId));

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow={owner ? "Seu documento" : "Compartilhado com a comunidade"}
        title={document.title}
        description={`${CATEGORY[document.category]} · ${document.fileName} · ${formatBytes(document.sizeBytes)}`}
        action={
          <Link href="/exames" className="text-sm font-semibold text-tomato hover:underline">
            Voltar
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={status.tone}>{status.label}</Badge>
              <Badge tone="neutral">{CATEGORY[document.category]}</Badge>
              {document.shareCount > 0 ? (
                <Badge tone="sky">
                  <Icon name="users" size={11} />
                  {document.shareCount} comunidade{document.shareCount === 1 ? "" : "s"}
                </Badge>
              ) : (
                <Badge tone="neutral">
                  <Icon name="lock" size={11} />
                  privado
                </Badge>
              )}
            </div>

            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted">Laboratório / emissor</dt>
                <dd>{document.labName || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Data de coleta</dt>
                <dd>{formatDate(document.collectedOn)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Data do resultado</dt>
                <dd>{formatDate(document.resultedOn)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Enviado em</dt>
                <dd>{formatDateTime(document.createdAt)}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-muted">Observações</dt>
                <dd className="whitespace-pre-line">{document.notes || "—"}</dd>
              </div>
            </dl>

            <div className="mt-5 flex flex-wrap gap-2">
              <a
                href={`/api/documents/${document.id}/download`}
                className="inline-flex items-center gap-2 rounded-full bg-tomato px-4 py-2.5 text-sm font-semibold text-white hover:bg-tomato-deep"
              >
                <Icon name="download" size={15} />
                Baixar original
              </a>
              {isPreviewable(document.mimeType) ? (
                <a
                  href={`/api/documents/${document.id}/download?preview=1`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface px-4 py-2.5 text-sm font-semibold hover:bg-surface-soft"
                >
                  <Icon name="eye" size={15} />
                  Abrir no navegador
                </a>
              ) : null}
              {document.examId ? (
                <Link
                  href={`/exames/exame/${document.examId}`}
                  className="inline-flex items-center gap-2 rounded-full bg-tomato-soft px-4 py-2.5 text-sm font-semibold text-tomato-deep hover:bg-[#f7dcd1]"
                >
                  <Icon name="activity" size={15} />
                  Ver resultados revisados
                </Link>
              ) : null}
            </div>

            {document.mimeType.startsWith("image/") ? (
              <div className="mt-4 overflow-hidden rounded-xl border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/documents/${document.id}/download?preview=1`}
                  alt={`Pré-visualização de ${document.title}`}
                  className="max-h-[520px] w-full object-contain"
                />
              </div>
            ) : null}

            {!owner ? (
              <div className="mt-4">
                <Notice tone="info">
                  Este documento foi compartilhado pela pessoa titular. Você não
                  pode editar metadados, excluir ou ver resultados estruturados.
                </Notice>
              </div>
            ) : null}
          </Card>

          {owner ? (
            <Card className="p-5">
              <details>
                <summary className="cursor-pointer text-base font-semibold">
                  Editar metadados
                </summary>
                <ActionForm action={updateDocumentAction} className="mt-4 space-y-3">
                  <input type="hidden" name="documentId" value={document.id} />
                  <Field label="Título" htmlFor="doc-title">
                    <Input id="doc-title" name="title" defaultValue={document.title} required maxLength={120} />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Laboratório / emissor" htmlFor="doc-lab">
                      <Input id="doc-lab" name="labName" defaultValue={document.labName ?? ""} maxLength={120} />
                    </Field>
                    <Field label="Status" htmlFor="doc-status">
                      <Select id="doc-status" name="status" defaultValue={document.status}>
                        <option value="received">Recebido</option>
                        <option value="processing">Processando</option>
                        <option value="awaiting_review">Aguardando revisão</option>
                        <option value="confirmed">Confirmado</option>
                        <option value="failed">Falhou</option>
                      </Select>
                    </Field>
                    <Field label="Coleta" htmlFor="doc-collected">
                      <Input id="doc-collected" name="collectedOn" type="date" max={todayIso()} defaultValue={document.collectedOn ?? ""} />
                    </Field>
                    <Field label="Resultado" htmlFor="doc-resulted">
                      <Input id="doc-resulted" name="resultedOn" type="date" max={todayIso()} defaultValue={document.resultedOn ?? ""} />
                    </Field>
                  </div>
                  <Field label="Observações" htmlFor="doc-notes">
                    <Textarea id="doc-notes" name="notes" defaultValue={document.notes ?? ""} maxLength={1000} rows={3} />
                  </Field>
                  <SubmitButton size="sm" pendingLabel="Salvando…">Salvar metadados</SubmitButton>
                </ActionForm>
              </details>
            </Card>
          ) : null}

          {owner ? (
            <Card className="p-5">
              <h2 className="text-base font-semibold">Excluir documento</h2>
              <p className="mt-1 text-xs text-muted">
                Remove o arquivo criptografado, os compartilhamentos e os vínculos.
                Exames estruturados continuam, mas sem o arquivo de origem.
              </p>
              <div className="mt-3">
                <ActionForm action={deleteDocumentAction} hideMessage>
                  <input type="hidden" name="documentId" value={document.id} />
                  <ConfirmButton
                    message="Excluir este documento definitivamente? Esta ação não pode ser desfeita."
                    variant="danger"
                    size="sm"
                  >
                    Excluir documento
                  </ConfirmButton>
                </ActionForm>
              </div>
            </Card>
          ) : null}
        </div>

        <aside className="space-y-6">
          {owner ? (
            <Card className="p-5">
              <h2 className="text-base font-semibold">Compartilhamento</h2>
              <p className="mt-1 text-xs text-muted">
                O compartilhamento é por documento. Um administrador da comunidade
                não ganha acesso além do que você liberar aqui.
              </p>
              <div className="mt-3 space-y-2">
                {communities.length === 0 ? (
                  <p className="text-sm text-muted">Você não participa de comunidades.</p>
                ) : (
                  communities.map((community) => {
                    const shared = sharedIds.has(community.id);
                    return (
                      <div
                        key={community.id}
                        className="flex items-center justify-between gap-2 rounded-xl border border-line px-3 py-2.5"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{community.name}</span>
                          <span className="block text-[0.65rem] text-muted">
                            {shared ? "compartilhado" : "privado"}
                          </span>
                        </span>
                        {shared ? (
                          <ActionForm action={unshareDocumentAction} hideMessage>
                            <input type="hidden" name="documentId" value={document.id} />
                            <input type="hidden" name="communityId" value={community.id} />
                            <SubmitButton size="sm" variant="ghost" pendingLabel="…">
                              Revogar
                            </SubmitButton>
                          </ActionForm>
                        ) : (
                          <ActionForm action={shareDocumentAction} hideMessage>
                            <input type="hidden" name="documentId" value={document.id} />
                            <input type="hidden" name="communityId" value={community.id} />
                            <SubmitButton size="sm" variant="secondary" pendingLabel="…">
                              Compartilhar
                            </SubmitButton>
                          </ActionForm>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          ) : (
            <Card className="p-5">
              <h2 className="text-base font-semibold">Respeito ao titular</h2>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                Este arquivo foi compartilhado de forma explícita. Não reproduza,
                interprete ou cobre resultados com base nele. O titular pode
                revogar o acesso a qualquer momento.
              </p>
            </Card>
          )}

          <Card className="p-5">
            <h2 className="text-base font-semibold">Integridade</h2>
            <p className="mt-1 text-xs text-muted">Hash SHA-256 do original:</p>
            <p className="mt-1 break-all font-mono text-[0.65rem] text-ink-soft">
              {document.sha256}
            </p>
            <p className="mt-3 text-[0.68rem] text-muted">
              Use o hash para conferir duplicatas. O conteúdo é validado e
              criptografado antes de ser persistido.
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
