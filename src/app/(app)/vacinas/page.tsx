import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { listDocuments, listVaccines } from "@/lib/data/documents";
import {
  Badge,
  Card,
  Checkbox,
  EmptyState,
  Field,
  Input,
  Notice,
  PageHeader,
  Select,
  Stat,
  Textarea,
} from "@/components/ui/Primitives";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { Icon } from "@/components/ui/Icon";
import {
  addVaccineAction,
  confirmVaccineAction,
  deleteVaccineAction,
} from "@/actions/vaccines";
import { formatDate, todayIso } from "@/lib/domain/dates";

export const metadata: Metadata = { title: "Vacinas" };
export const dynamic = "force-dynamic";

export default async function VaccinesPage() {
  const user = await requireUser("/vacinas");
  const [vaccines, documents] = await Promise.all([
    listVaccines(user.id),
    listDocuments(user.id),
  ]);
  const confirmed = vaccines.filter((vaccine) => vaccine.status === "confirmed");
  const pending = vaccines.filter((vaccine) => vaccine.status === "pending");

  return (
    <div>
      <PageHeader
        eyebrow="Minha saúde"
        title="Vacinas e prevenção"
        description="Histórico cronológico, comprovantes e o que ainda precisa de conferência. Ausência de registro não é prova de ausência de vacina."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Registros" value={vaccines.length} hint="histórico pessoal" icon="shield" tone="tomato" />
        <Stat label="Confirmados" value={confirmed.length} hint="com dados conferidos" icon="check" tone="basil" />
        <Stat label="Pendentes" value={pending.length} hint="revise antes de considerar definitivo" icon="clock" tone="saffron" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          {vaccines.length === 0 ? (
            <EmptyState
              title="Nenhuma vacina registrada"
              description="Adicione uma dose com data e, se tiver, o comprovante. O histórico é seu."
              icon="shield"
            />
          ) : (
            vaccines.map((vaccine) => (
              <Card key={vaccine.id} className="p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-basil-soft text-basil">
                      <Icon name="shield" size={19} />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">
                        {vaccine.name} {vaccine.doseLabel ? `· ${vaccine.doseLabel}` : ""}
                      </p>
                      <p className="text-xs text-muted">
                        {formatDate(vaccine.appliedOn)}
                        {vaccine.manufacturer ? ` · ${vaccine.manufacturer}` : ""}
                        {vaccine.location ? ` · ${vaccine.location}` : ""}
                      </p>
                      {vaccine.notes ? <p className="mt-1 text-xs text-muted">{vaccine.notes}</p> : null}
                    </div>
                  </div>
                  <Badge tone={vaccine.status === "confirmed" ? "basil" : "saffron"}>
                    {vaccine.status === "confirmed" ? "confirmada" : "pendente"}
                  </Badge>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {vaccine.documentId ? (
                    <Link
                      href={`/exames/${vaccine.documentId}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold hover:bg-surface-soft"
                    >
                      <Icon name="file" size={13} />
                      Ver comprovante
                    </Link>
                  ) : null}
                  {vaccine.status === "pending" ? (
                    <ActionForm action={confirmVaccineAction} hideMessage>
                      <input type="hidden" name="vaccineId" value={vaccine.id} />
                      <SubmitButton size="sm" variant="basil" pendingLabel="…">
                        Confirmar dados
                      </SubmitButton>
                    </ActionForm>
                  ) : null}
                  <ActionForm action={deleteVaccineAction} hideMessage>
                    <input type="hidden" name="vaccineId" value={vaccine.id} />
                    <ConfirmButton message="Remover este registro de vacina?" variant="ghost" size="sm">
                      Remover
                    </ConfirmButton>
                  </ActionForm>
                </div>
              </Card>
            ))
          )}
        </div>

        <aside className="space-y-6">
          <Card className="p-5">
            <h2 className="text-base font-semibold">Adicionar registro</h2>
            <ActionForm action={addVaccineAction} className="mt-3 space-y-2.5" resetOnSuccess>
              <Field label="Vacina" htmlFor="vaccine-name">
                <Input id="vaccine-name" name="name" required maxLength={120} placeholder="ex.: Influenza" />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Dose" htmlFor="vaccine-dose">
                  <Input id="vaccine-dose" name="doseLabel" maxLength={60} placeholder="ex.: 3ª dose" />
                </Field>
                <Field label="Data" htmlFor="vaccine-date">
                  <Input id="vaccine-date" name="appliedOn" type="date" max={todayIso()} required />
                </Field>
              </div>
              <Field label="Fabricante" htmlFor="vaccine-manufacturer">
                <Input id="vaccine-manufacturer" name="manufacturer" maxLength={120} placeholder="opcional" />
              </Field>
              <Field label="Local de aplicação" htmlFor="vaccine-location">
                <Input id="vaccine-location" name="location" maxLength={160} placeholder="opcional" />
              </Field>
              {documents.length > 0 ? (
                <Field label="Comprovante" htmlFor="vaccine-document" hint="Opcional. Envie o arquivo antes em Exames.">
                  <Select id="vaccine-document" name="documentId" defaultValue="">
                    <option value="">Sem comprovante</option>
                    {documents.map((document) => (
                      <option key={document.id} value={document.id}>
                        {document.title}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : null}
              <Field label="Notas" htmlFor="vaccine-notes">
                <Textarea id="vaccine-notes" name="notes" maxLength={500} rows={2} />
              </Field>
              <Checkbox
                name="confirm"
                label="Já conferi os dados com o comprovante"
                description="Sem isso, o registro fica pendente e não aparece como confirmado no perfil compartilhado."
              />
              <SubmitButton size="sm" pendingLabel="Salvando…">Adicionar vacina</SubmitButton>
            </ActionForm>
          </Card>

          <Card className="p-5">
            <h2 className="text-base font-semibold">Sem recomendação automática</h2>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              O Pizza Health não presume que você recebeu uma vacina porque não há
              registro, nem gera recomendação clínica individual. Para calendário e
              indicações oficiais, consulte o{" "}
              <a
                href="https://www.gov.br/saude/pt-br/vacinacao"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                Ministério da Saúde
              </a>{" "}
              ou um profissional de saúde.
            </p>
          </Card>

          <Notice tone="info">
            Dados de vacinação compartilhados com a comunidade mostram apenas
            registros confirmados. Pendências ficam privadas até a revisão.
          </Notice>
        </aside>
      </div>
    </div>
  );
}
