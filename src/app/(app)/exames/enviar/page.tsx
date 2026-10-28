import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { listCommunitiesForUser } from "@/lib/data/communities";
import { getEnv } from "@/lib/env";
import { PageHeader, Card, Field, Input, Notice, Select, Textarea } from "@/components/ui/Primitives";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { uploadDocumentAction } from "@/actions/documents";
import { formatBytes } from "@/lib/crypto/documents";
import { todayIso } from "@/lib/domain/dates";

export const metadata: Metadata = { title: "Enviar documento" };
export const dynamic = "force-dynamic";

export default async function UploadDocumentPage() {
  const user = await requireUser("/exames/enviar");
  const communities = await listCommunitiesForUser(user.id);
  const env = getEnv();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Central de documentos"
        title="Enviar documento"
        description="O original fica protegido. Você define os metadados e decide se compartilha com alguma comunidade."
        action={
          <Link href="/exames" className="text-sm font-semibold text-tomato hover:underline">
            Voltar
          </Link>
        }
      />

      <Card className="p-5 sm:p-6">
        <ActionForm action={uploadDocumentAction} className="space-y-4">
          <Field label="Título do documento" htmlFor="title" hint="ex.: Hemograma completo — outubro">
            <Input id="title" name="title" required minLength={2} maxLength={120} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Categoria" htmlFor="category">
              <Select id="category" name="category" defaultValue="exam">
                <option value="exam">Exame</option>
                <option value="vaccine">Comprovante de vacina</option>
                <option value="other">Outro documento de saúde</option>
              </Select>
            </Field>
            <Field label="Laboratório / emissor" htmlFor="labName">
              <Input id="labName" name="labName" maxLength={120} placeholder="opcional" />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Data de coleta" htmlFor="collectedOn">
              <Input id="collectedOn" name="collectedOn" type="date" max={todayIso()} />
            </Field>
            <Field label="Data do resultado" htmlFor="resultedOn">
              <Input id="resultedOn" name="resultedOn" type="date" max={todayIso()} />
            </Field>
          </div>

          <Field
            label="Observações"
            htmlFor="notes"
            hint="Não copie diagnósticos ou interpretações aqui se não quiser. Este campo é privado."
          >
            <Textarea id="notes" name="notes" maxLength={1000} rows={3} />
          </Field>

          <Field
            label="Arquivo"
            htmlFor="file"
            hint={`PDF, CSV, XLS, XLSX, JPG ou PNG. Até ${formatBytes(env.MAX_UPLOAD_BYTES)}. O conteúdo é validado.`}
          >
            <Input
              id="file"
              name="file"
              type="file"
              required
              accept=".pdf,.csv,.xls,.xlsx,.jpg,.jpeg,.png"
              className="file:mr-3 file:rounded-full file:border-0 file:bg-tomato-soft file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-tomato-deep"
            />
          </Field>

          {communities.length > 0 ? (
            <Field label="Compartilhar com uma comunidade agora?" htmlFor="shareCommunityId">
              <Select id="shareCommunityId" name="shareCommunityId" defaultValue="">
                <option value="">Não compartilhar (recomendado)</option>
                {communities.map((community) => (
                  <option key={community.id} value={community.id}>
                    {community.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}

          <div className="rounded-xl border border-line bg-surface-soft p-3.5 text-xs text-muted">
            <p className="flex items-center gap-2 font-semibold text-ink-soft">
              <span aria-hidden="true">🔒</span> O que acontece com o arquivo
            </p>
            <ul className="mt-2 space-y-1.5">
              <li>Validamos a assinatura binária e recusamos formatos ativos.</li>
              <li>O conteúdo é criptografado com AES-256-GCM antes de ser gravado.</li>
              <li>O download exige sessão e autorização conferida no servidor.</li>
              <li>Duplicatas do mesmo arquivo são detectadas pelo hash SHA-256.</li>
            </ul>
          </div>

          <Notice tone="warning">
            Envie apenas documentos seus ou de alguém que autorizou. O Pizza Health
            não substitui o laudo original nem faz diagnóstico.
          </Notice>

          <SubmitButton pendingLabel="Enviando e protegendo…">Enviar documento</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
