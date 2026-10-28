import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getExam, listExamResults } from "@/lib/data/documents";
import {
  Badge,
  Card,
  Field,
  Input,
  Notice,
  PageHeader,
  Textarea,
} from "@/components/ui/Primitives";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { Icon } from "@/components/ui/Icon";
import {
  addExamResultAction,
  deleteExamResultAction,
  reviewExamResultAction,
  updateExamMetaAction,
} from "@/actions/documents";
import { formatDate, formatDateTime, todayIso } from "@/lib/domain/dates";

export const metadata: Metadata = { title: "Exame" };
export const dynamic = "force-dynamic";

export default async function ExamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser("/exames");
  const { id } = await params;
  const exam = await getExam(id, user.id);
  if (!exam) notFound();
  const results = await listExamResults(exam.id);
  const pending = results.filter((result) => result.validationStatus === "pending").length;
  const confirmed = results.filter((result) => result.validationStatus === "confirmed").length;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="Exame estruturado"
        title={exam.labName || "Exame"}
        description={`Coleta ${formatDate(exam.collectedOn)} · resultado ${formatDate(exam.resultedOn)}`}
        action={
          <Link href="/exames" className="text-sm font-semibold text-tomato hover:underline">
            Voltar
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Badge tone={exam.status === "confirmed" ? "basil" : exam.status === "awaiting_review" ? "saffron" : "neutral"}>
          {exam.status === "confirmed" ? "confirmado" : exam.status === "awaiting_review" ? "aguardando revisão" : "rascunho"}
        </Badge>
        <Badge tone="neutral">{results.length} indicador{results.length === 1 ? "" : "es"}</Badge>
        {pending > 0 ? <Badge tone="tomato">{pending} pendente{pending === 1 ? "" : "s"}</Badge> : null}
        {confirmed > 0 ? <Badge tone="basil">{confirmed} confirmado{confirmed === 1 ? "" : "s"}</Badge> : null}
      </div>

      {exam.documentId ? (
        <div className="mb-4">
          <Link
            href={`/exames/${exam.documentId}`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-tomato hover:underline"
          >
            <Icon name="file" size={15} />
            Abrir documento de origem
          </Link>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold">Indicadores</h2>
              <p className="text-xs text-muted">Revise cada valor contra o laudo original.</p>
            </div>

            {results.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-line-strong bg-surface-soft p-4 text-sm text-muted">
                Nenhum indicador registrado. Adicione manualmente ao lado, copiando
                nome, valor, unidade e intervalo de referência do laudo.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-line">
                {results.map((result) => (
                  <li key={result.id} className="py-3.5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">{result.name}</p>
                        <p className="mt-0.5 text-sm text-ink-soft">
                          {result.valueText}
                          {result.unit ? ` ${result.unit}` : ""}
                          {result.referenceRange ? (
                            <span className="text-xs text-muted"> · referência {result.referenceRange}</span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 text-[0.65rem] text-muted">
                          {result.extractionMethod === "manual" ? "digitação manual" : result.extractionMethod}
                          {result.pageRef ? ` · ${result.pageRef}` : ""}
                        </p>
                      </div>
                      <Badge
                        tone={
                          result.validationStatus === "confirmed"
                            ? "basil"
                            : result.validationStatus === "rejected"
                              ? "tomato"
                              : "saffron"
                        }
                      >
                        {result.validationStatus === "confirmed"
                          ? "confirmado"
                          : result.validationStatus === "rejected"
                            ? "rejeitado"
                            : "aguardando revisão"}
                      </Badge>
                    </div>
                    {result.validationStatus === "pending" ? (
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        <ActionForm action={reviewExamResultAction} hideMessage>
                          <input type="hidden" name="resultId" value={result.id} />
                          <input type="hidden" name="decision" value="confirmed" />
                          <SubmitButton size="sm" variant="basil" pendingLabel="…">
                            Confirmar valor
                          </SubmitButton>
                        </ActionForm>
                        <ActionForm action={reviewExamResultAction} hideMessage>
                          <input type="hidden" name="resultId" value={result.id} />
                          <input type="hidden" name="decision" value="rejected" />
                          <SubmitButton size="sm" variant="secondary" pendingLabel="…">
                            Rejeitar
                          </SubmitButton>
                        </ActionForm>
                      </div>
                    ) : (
                      <div className="mt-2">
                        <ActionForm action={deleteExamResultAction} hideMessage>
                          <input type="hidden" name="resultId" value={result.id} />
                          <ConfirmButton
                            message="Remover este indicador do exame?"
                            variant="ghost"
                            size="sm"
                          >
                            Remover indicador
                          </ConfirmButton>
                        </ActionForm>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="text-base font-semibold">Notas do exame</h2>
            <p className="mt-2 whitespace-pre-line text-sm text-ink-soft">
              {exam.notes || "Sem notas."}
            </p>
            <p className="mt-3 text-xs text-muted">
              Criado em {formatDateTime(exam.createdAt)}.
            </p>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card className="p-5">
            <h2 className="text-base font-semibold">Adicionar indicador</h2>
            <p className="mt-1 text-xs text-muted">
              Copie exatamente do laudo. O valor entra como pendente até sua
              confirmação.
            </p>
            <ActionForm action={addExamResultAction} className="mt-3 space-y-2.5" resetOnSuccess>
              <input type="hidden" name="examId" value={exam.id} />
              <Field label="Nome do exame" htmlFor="result-name">
                <Input id="result-name" name="name" required maxLength={120} placeholder="ex.: Hemoglobina" />
              </Field>
              <Field label="Valor (como impresso)" htmlFor="result-value">
                <Input id="result-value" name="valueText" required maxLength={60} placeholder="ex.: 14,2" />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Valor numérico" htmlFor="result-numeric" hint="opcional, para comparação">
                  <Input id="result-numeric" name="valueNumeric" inputMode="decimal" placeholder="14.2" />
                </Field>
                <Field label="Unidade" htmlFor="result-unit">
                  <Input id="result-unit" name="unit" maxLength={24} placeholder="g/dL" />
                </Field>
              </div>
              <Field label="Intervalo de referência" htmlFor="result-reference">
                <Input id="result-reference" name="reference" maxLength={120} placeholder="12,0 a 16,0" />
              </Field>
              <Field label="Página / local" htmlFor="result-page">
                <Input id="result-page" name="pageRef" maxLength={60} placeholder="p. 2" />
              </Field>
              <SubmitButton size="sm" pendingLabel="Adicionando…">
                Adicionar indicador
              </SubmitButton>
            </ActionForm>
          </Card>

          <Card className="p-5">
            <h2 className="text-base font-semibold">Editar informações do exame</h2>
            <ActionForm action={updateExamMetaAction} className="mt-3 space-y-2.5">
              <input type="hidden" name="examId" value={exam.id} />
              <Field label="Laboratório / emissor" htmlFor="exam-edit-lab">
                <Input id="exam-edit-lab" name="labName" defaultValue={exam.labName ?? ""} maxLength={120} />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Coleta" htmlFor="exam-edit-collected">
                  <Input id="exam-edit-collected" name="collectedOn" type="date" max={todayIso()} defaultValue={exam.collectedOn ?? ""} />
                </Field>
                <Field label="Resultado" htmlFor="exam-edit-resulted">
                  <Input id="exam-edit-resulted" name="resultedOn" type="date" max={todayIso()} defaultValue={exam.resultedOn ?? ""} />
                </Field>
              </div>
              <Field label="Notas" htmlFor="exam-edit-notes">
                <Textarea id="exam-edit-notes" name="notes" rows={2} maxLength={1000} defaultValue={exam.notes ?? ""} />
              </Field>
              <SubmitButton size="sm" variant="secondary" pendingLabel="Salvando…">
                Salvar
              </SubmitButton>
            </ActionForm>
          </Card>

          <Notice tone="warning">
            O Pizza Health não declara se um resultado é normal ou alterado. Intervalos
            e métodos variam entre laboratórios. Leve o laudo original ao profissional
            que acompanha você.
          </Notice>
        </aside>
      </div>
    </div>
  );
}
