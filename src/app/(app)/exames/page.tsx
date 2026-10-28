import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import {
  countDocuments,
  countDocumentsAwaitingReview,
  listDocuments,
  listExams,
  type DocumentCategory,
} from "@/lib/data/documents";
import { countVaccines } from "@/lib/data/documents";
import {
  Badge,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Stat,
  Textarea,
} from "@/components/ui/Primitives";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { formatBytes } from "@/lib/crypto/documents";
import { formatDate, todayIso } from "@/lib/domain/dates";
import { createExamAction } from "@/actions/documents";

export const metadata: Metadata = { title: "Exames e documentos" };
export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; tone: "neutral" | "tomato" | "basil" | "saffron" | "sky" }> = {
  received: { label: "recebido", tone: "neutral" },
  processing: { label: "processando", tone: "sky" },
  awaiting_review: { label: "aguardando revisão", tone: "saffron" },
  confirmed: { label: "confirmado", tone: "basil" },
  failed: { label: "falhou", tone: "tomato" },
};

const CATEGORY: Record<string, string> = {
  exam: "Exame",
  vaccine: "Vacina",
  other: "Outro",
};

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string; q?: string; removido?: string }>;
}) {
  const user = await requireUser("/exames");
  const params = await searchParams;
  const category =
    params.categoria === "exam" || params.categoria === "vaccine" || params.categoria === "other"
      ? (params.categoria as DocumentCategory)
      : undefined;
  const search = typeof params.q === "string" ? params.q : "";
  const [documents, exams, total, pending, vaccines] = await Promise.all([
    listDocuments(user.id, { category, query: search }),
    listExams(user.id),
    countDocuments(user.id),
    countDocumentsAwaitingReview(user.id),
    countVaccines(user.id),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow="Minha saúde"
        title="Exames e documentos"
        description="Arquivos originais protegidos, metadados organizados e resultados que só valem depois da sua revisão."
        action={
          <ButtonLink href="/exames/enviar">
            <Icon name="plus" size={15} />
            Enviar documento
          </ButtonLink>
        }
      />

      {params.removido ? (
        <div className="mb-4 rounded-xl border border-basil/30 bg-basil-soft px-3.5 py-2.5 text-sm text-basil">
          Documento removido da central.
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Documentos" value={total} hint="arquivos na sua central" icon="file" tone="tomato" />
        <Stat label="Aguardando revisão" value={pending} hint="confira antes de considerar definitivo" icon="clock" tone="saffron" />
        <Stat label="Vacinas registradas" value={vaccines} hint="histórico separado dos exames" icon="shield" tone="basil" />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {[
          ["", "Todos"],
          ["exam", "Exames"],
          ["vaccine", "Vacinas"],
          ["other", "Outros"],
        ].map(([value, label]) => {
          const href = value
            ? `/exames?categoria=${value}${search ? `&q=${encodeURIComponent(search)}` : ""}`
            : `/exames${search ? `?q=${encodeURIComponent(search)}` : ""}`;
          const active = (category ?? "") === value;
          return (
            <Link
              key={label}
              href={href}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                active ? "bg-tomato text-white" : "border border-line bg-surface text-ink-soft hover:bg-surface-soft"
              }`}
            >
              {label}
            </Link>
          );
        })}
        <form method="get" className="ml-auto flex items-center gap-2">
          {category ? <input type="hidden" name="categoria" value={category} /> : null}
          <label htmlFor="doc-search" className="sr-only">
            Buscar documento
          </label>
          <Input
            id="doc-search"
            name="q"
            defaultValue={search}
            placeholder="Buscar por título…"
            className="w-48 py-1.5 text-xs"
          />
          <button type="submit" className="rounded-full border border-line bg-surface p-2 text-ink-soft hover:bg-surface-soft" aria-label="Buscar">
            <Icon name="search" size={15} />
          </button>
        </form>
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          {documents.length === 0 ? (
            <EmptyState
              title="Nenhum documento por aqui"
              description="Envie um PDF, planilha ou foto. O arquivo é validado, criptografado e fica acessível só para você até você compartilhar."
              icon="file"
              action={<ButtonLink href="/exames/enviar">Enviar o primeiro documento</ButtonLink>}
            />
          ) : (
            documents.map((document) => {
              const status = STATUS[document.status] ?? STATUS.received;
              return (
                <Card key={document.id} className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-tomato-soft text-tomato">
                        <Icon name={document.mimeType.startsWith("image/") ? "eye" : "file"} size={19} />
                      </span>
                      <div className="min-w-0">
                        <Link href={`/exames/${document.id}`} className="block truncate text-sm font-semibold hover:text-tomato">
                          {document.title}
                        </Link>
                        <p className="mt-0.5 text-xs text-muted">
                          {CATEGORY[document.category]} · {formatBytes(document.sizeBytes)}
                          {document.collectedOn ? ` · coleta ${formatDate(document.collectedOn)}` : ""}
                          {document.labName ? ` · ${document.labName}` : ""}
                        </p>
                        <p className="mt-1 truncate text-[0.65rem] text-muted">{document.fileName}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {status ? <Badge tone={status.tone}>{status.label}</Badge> : null}
                      {document.shareCount > 0 ? (
                        <Badge tone="sky">
                          <Icon name="users" size={11} />
                          {document.shareCount}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <a
                      href={`/api/documents/${document.id}/download`}
                      className="rounded-full border border-line bg-surface px-3 py-1.5 font-semibold hover:bg-surface-soft"
                    >
                      Baixar original
                    </a>
                    {document.examId ? (
                      <Link
                        href={`/exames/exame/${document.examId}`}
                        className="rounded-full bg-tomato-soft px-3 py-1.5 font-semibold text-tomato-deep hover:bg-[#f7dcd1]"
                      >
                        Ver resultados
                      </Link>
                    ) : null}
                    <Link href={`/exames/${document.id}`} className="text-muted hover:text-tomato">
                      Detalhes e compartilhamento
                    </Link>
                  </div>
                </Card>
              );
            })
          )}
        </div>

        <aside className="space-y-6">
          <Card className="p-5">
            <h2 className="text-base font-semibold">Exames estruturados</h2>
            <p className="mt-1 text-xs text-muted">
              Registre indicadores manualmente. Nada é interpretado como diagnóstico.
            </p>
            {exams.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Nenhum exame estruturado.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {exams.slice(0, 8).map((exam) => (
                  <li key={exam.id} className="py-2.5">
                    <Link href={`/exames/exame/${exam.id}`} className="flex items-center justify-between gap-2 text-sm font-medium hover:text-tomato">
                      <span className="truncate">
                        {exam.labName || "Exame"} · {formatDate(exam.collectedOn ?? exam.createdAt.slice(0, 10))}
                      </span>
                      <span className="text-xs text-muted">{exam.resultCount}</span>
                    </Link>
                    <p className="text-[0.65rem] text-muted">
                      {exam.status === "confirmed" ? "confirmado" : exam.status === "awaiting_review" ? "aguardando revisão" : "rascunho"}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            <details className="mt-4 rounded-xl border border-line bg-surface-soft p-3">
              <summary className="cursor-pointer text-sm font-semibold text-tomato-deep">
                Criar exame manual
              </summary>
              <ActionForm action={createExamAction} className="mt-3 space-y-2">
                <Field label="Laboratório" htmlFor="exam-lab">
                  <Input id="exam-lab" name="labName" maxLength={120} placeholder="opcional" />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Coleta" htmlFor="exam-collected">
                    <Input id="exam-collected" name="collectedOn" type="date" max={todayIso()} />
                  </Field>
                  <Field label="Resultado" htmlFor="exam-resulted">
                    <Input id="exam-resulted" name="resultedOn" type="date" max={todayIso()} />
                  </Field>
                </div>
                <Field label="Notas" htmlFor="exam-notes">
                  <Textarea id="exam-notes" name="notes" rows={2} maxLength={1000} />
                </Field>
                <SubmitButton size="sm" variant="secondary" pendingLabel="Criando…">
                  Criar exame
                </SubmitButton>
              </ActionForm>
            </details>
          </Card>

          <Card className="p-5">
            <h2 className="text-base font-semibold">Como tratamos arquivos</h2>
            <ul className="mt-3 space-y-2.5 text-xs text-muted">
              <li className="flex gap-2">
                <Icon name="check" size={14} />
                Validação pelo conteúdo real, não pelo nome.
              </li>
              <li className="flex gap-2">
                <Icon name="lock" size={14} />
                Criptografia AES-256-GCM antes de gravar no banco.
              </li>
              <li className="flex gap-2">
                <Icon name="eye" size={14} />
                Acesso conferido no servidor a cada download.
              </li>
              <li className="flex gap-2">
                <Icon name="alert" size={14} />
                Formatos ativos como HTML e SVG são recusados.
              </li>
            </ul>
            <p className="mt-3 text-[0.68rem] text-muted">
              A extração automática de PDF e planilhas não está habilitada neste
              MVP. O registro de resultados é manual e revisado por você.
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
