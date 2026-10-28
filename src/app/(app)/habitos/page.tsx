import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import {
  ensureDefaultHabits,
  goalReached,
  listEntries,
  listGoals,
  listHabitTypes,
  todayEntries,
} from "@/lib/data/habits";
import { listCommunitiesForUser } from "@/lib/data/communities";
import {
  currentStreak,
  formatDate,
  formatWeekday,
  lastNDays,
  startOfWeek,
  todayIso,
} from "@/lib/domain/dates";
import { formatAmount, habitPrompt } from "@/lib/domain/habits";
import { PageHeader, Badge, Card, EmptyState, Field, Input, ProgressBar, Select, Stat, Textarea } from "@/components/ui/Primitives";
import { Icon, type IconName } from "@/components/ui/Icon";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { WeeklyBars, StreakDots } from "@/components/ui/Charts";
import {
  archiveGoalAction,
  createGoalAction,
  createHabitTypeAction,
  deleteHabitEntryAction,
  saveHabitEntryAction,
  shareHabitAction,
} from "@/actions/habits";

export const metadata: Metadata = { title: "Hábitos" };
export const dynamic = "force-dynamic";

export default async function HabitsPage() {
  const user = await requireUser("/habitos");
  await ensureDefaultHabits(user.id);
  const today = todayIso();
  const weekStart = startOfWeek(today);
  const weekDays = lastNDays(7);
  const monthStart = lastNDays(30)[0] ?? today;

  const [types, entries, goals, communities, todayList] = await Promise.all([
    listHabitTypes(user.id),
    listEntries(user.id, monthStart, today),
    listGoals(user.id),
    listCommunitiesForUser(user.id),
    todayEntries(user.id),
  ]);

  const todayByType = new Map(todayList.map((entry) => [entry.habitTypeId, entry]));
  const recent = [...entries].sort((a, b) => b.entryDate.localeCompare(a.entryDate) || b.createdAt.localeCompare(a.createdAt));
  const allDates = [...new Set(entries.map((entry) => entry.entryDate))];
  const streak = currentStreak(allDates, today);
  const water = types.find((type) => type.slug === "agua");
  const waterByDay = new Map(
    entries.filter((entry) => entry.habitSlug === "agua").map((entry) => [entry.entryDate, entry.amount]),
  );
  const waterData = lastNDays(14).map((day) => ({
    label: day.slice(8, 10),
    value: waterByDay.get(day) ?? 0,
  }));
  const datesByType = new Map<string, string[]>();
  for (const entry of entries) {
    const list = datesByType.get(entry.habitTypeId) ?? [];
    list.push(entry.entryDate);
    datesByType.set(entry.habitTypeId, list);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Minha saúde"
        title="Diário de hábitos"
        description="Registre o que já aconteceu. Sem metas médicas universais, sem cobrança de perfeição."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="basil">
              <Icon name="activity" size={12} />
              {streak} dia{streak === 1 ? "" : "s"} de sequência
            </Badge>
            <Link
              href="/perfil/importar"
              className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold hover:bg-surface-soft"
            >
              Importar Apple Saúde
            </Link>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Registros em 30 dias" value={entries.length} icon="calendar" tone="tomato" />
        <Stat label="Hábitos ativos" value={types.length} hint="inclui hábitos personalizados" icon="target" tone="basil" />
        <Stat label="Metas ativas" value={goals.length} hint="metas que você definiu" icon="flag" tone="saffron" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card className="p-5">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Hoje</h2>
                <p className="text-sm text-muted">{formatDate(today)}</p>
              </div>
              <p className="text-xs text-muted">Você pode atualizar o valor a qualquer momento.</p>
            </div>
            {types.length === 0 ? (
              <EmptyState title="Nenhum hábito ativo" description="Crie um hábito personalizado ao lado." icon="activity" />
            ) : (
              <div className="space-y-3">
                {types.map((type) => {
                  const entry = todayByType.get(type.id);
                  const dates = datesByType.get(type.id) ?? [];
                  const typeStreak = currentStreak(dates, today);
                  const iconName = (type.icon as IconName) ?? "spark";
                  return (
                    <div key={type.id} className="rounded-xl border border-line p-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-tomato-soft text-tomato">
                            <Icon name={iconName} size={17} />
                          </span>
                          <div>
                            <p className="text-sm font-semibold">{type.name}</p>
                            <p className="text-xs text-muted">
                              meta {formatAmount(type.targetValue, type.unit)} · sequência {typeStreak} dia{typeStreak === 1 ? "" : "s"}
                            </p>
                          </div>
                        </div>
                        <Badge tone={entry ? "basil" : "neutral"}>
                          {entry ? formatAmount(entry.amount, type.unit) : "sem registro hoje"}
                        </Badge>
                      </div>
                      <ActionForm
                        action={saveHabitEntryAction}
                        className="mt-3 flex flex-wrap items-end gap-2"
                        resetOnSuccess
                        hideMessage
                      >
                        <input type="hidden" name="habitTypeId" value={type.id} />
                        <input type="hidden" name="date" value={today} />
                        <div className="min-w-32 flex-1">
                          <label htmlFor={`amount-${type.id}`} className="sr-only">
                            {habitPrompt(type.unit)}
                          </label>
                          <Input
                            id={`amount-${type.id}`}
                            name="amount"
                            type="number"
                            min="0.1"
                            step="0.1"
                            required
                            defaultValue={entry?.amount ?? ""}
                            placeholder={`ex.: ${type.targetValue}`}
                          />
                        </div>
                        <div className="min-w-40 flex-1">
                          <label htmlFor={`note-${type.id}`} className="sr-only">
                            Observação opcional
                          </label>
                          <Input
                            id={`note-${type.id}`}
                            name="note"
                            maxLength={280}
                            placeholder="Observação opcional"
                            defaultValue={entry?.note ?? ""}
                          />
                        </div>
                        <SubmitButton variant={entry ? "secondary" : "primary"} size="sm" pendingLabel="Salvando…">
                          {entry ? "Atualizar" : "Registrar"}
                        </SubmitButton>
                      </ActionForm>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">Semana em uma olhada</h2>
              <Badge tone="neutral">últimos 7 dias</Badge>
            </div>
            <div className="space-y-3">
              {types.map((type) => (
                <div key={type.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-soft px-3.5 py-2.5">
                  <p className="text-sm font-medium">{type.name}</p>
                  <StreakDots
                    days={weekDays}
                    active={new Set(weekDays.filter((day) => entries.some((entry) => entry.habitTypeId === type.id && entry.entryDate === day)))}
                  />
                </div>
              ))}
            </div>
            {water ? (
              <div className="mt-5">
                <h3 className="mb-2 text-sm font-semibold">Água nos últimos 14 dias</h3>
                <WeeklyBars data={waterData} target={water.targetValue} unit="ml" tone="sky" title="Água nos últimos 14 dias" />
              </div>
            ) : null}
          </Card>

          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">Histórico recente</h2>
              <Link href="/inicio" className="text-xs font-semibold text-tomato hover:underline">
                Voltar ao início
              </Link>
            </div>
            {recent.length === 0 ? (
              <EmptyState title="Nada por aqui ainda" description="O primeiro registro cria seu histórico." icon="calendar" />
            ) : (
              <ul className="divide-y divide-line">
                {recent.slice(0, 12).map((entry) => (
                  <li key={entry.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-paper-deep text-ink-soft">
                        <Icon name={(entry.icon as IconName) ?? "spark"} size={15} />
                      </span>
                      <div>
                        <p className="text-sm font-medium">
                          {entry.habitName} · {formatAmount(entry.amount, entry.unit)}
                        </p>
                        <p className="text-xs text-muted">
                          {formatDate(entry.entryDate)} · {formatWeekday(entry.entryDate)}
                          {entry.note ? ` · ${entry.note}` : ""}
                        </p>
                      </div>
                    </div>
                    <ActionForm action={deleteHabitEntryAction} hideMessage>
                      <input type="hidden" name="entryId" value={entry.id} />
                      <ConfirmButton
                        message="Remover este registro? Os pontos correspondentes também saem do placar."
                        variant="ghost"
                        size="sm"
                      >
                        Remover
                      </ConfirmButton>
                    </ActionForm>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="text-base font-semibold">Metas pessoais</h2>
            <p className="mt-1 text-xs text-muted">
              Metas são suas. Elas não são recomendação clínica.
            </p>
            {goals.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Nenhuma meta ativa.</p>
            ) : (
              <ul className="mt-3 space-y-4">
                {goals.map((goal) => {
                  const start = goal.period === "weekly" ? weekStart : today;
                  const total = entries
                    .filter((entry) => entry.habitTypeId === goal.habitTypeId && entry.entryDate >= start)
                    .reduce((sum, entry) => sum + entry.amount, 0);
                  return (
                    <li key={goal.id}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">{goal.title}</p>
                          <p className="text-xs text-muted">
                            {goal.period === "weekly" ? "semanal" : "diária"} · {goal.habitName}
                          </p>
                        </div>
                        <ActionForm action={archiveGoalAction} hideMessage>
                          <input type="hidden" name="goalId" value={goal.id} />
                          <ConfirmButton message="Arquivar esta meta?" variant="ghost" size="sm">
                            Arquivar
                          </ConfirmButton>
                        </ActionForm>
                      </div>
                      <div className="mt-2">
                        <ProgressBar
                          value={total}
                          max={goal.targetValue}
                          tone={goalReached(total, goal.targetValue) ? "basil" : "tomato"}
                          label={`${formatAmount(total, goal.unit)} de ${formatAmount(goal.targetValue, goal.unit)}`}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <details className="mt-4 rounded-xl border border-line bg-surface-soft p-3">
              <summary className="cursor-pointer text-sm font-semibold text-tomato-deep">
                Criar nova meta
              </summary>
              <ActionForm action={createGoalAction} className="mt-3 space-y-3" resetOnSuccess>
                <Field label="Hábito" htmlFor="goal-habit">
                  <Select id="goal-habit" name="habitTypeId" required>
                    {types.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name} ({type.unit})
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Título" htmlFor="goal-title">
                  <Input id="goal-title" name="title" required maxLength={80} placeholder="ex.: beber 2 L por dia" />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Meta" htmlFor="goal-target">
                    <Input id="goal-target" name="target" type="number" min="0.1" step="0.1" required />
                  </Field>
                  <Field label="Período" htmlFor="goal-period">
                    <Select id="goal-period" name="period" defaultValue="daily">
                      <option value="daily">Diária</option>
                      <option value="weekly">Semanal</option>
                    </Select>
                  </Field>
                </div>
                <SubmitButton size="sm" pendingLabel="Criando…">Criar meta</SubmitButton>
              </ActionForm>
            </details>
          </Card>

          <Card className="p-5">
            <h2 className="text-base font-semibold">Compartilhar no feed</h2>
            <p className="mt-1 text-xs text-muted">
              Só o registro escolhido sai do seu espaço privado. Nada automático.
            </p>
            {communities.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Entre em uma comunidade para compartilhar.</p>
            ) : recent.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Registre um hábito primeiro.</p>
            ) : (
              <ActionForm action={shareHabitAction} className="mt-3 space-y-3" resetOnSuccess>
                <Field label="Comunidade" htmlFor="share-community">
                  <Select id="share-community" name="communityId" required>
                    {communities.map((community) => (
                      <option key={community.id} value={community.id}>
                        {community.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Registro" htmlFor="share-entry">
                  <Select id="share-entry" name="entryId" required>
                    {recent.slice(0, 8).map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {formatDate(entry.entryDate)} · {entry.habitName} · {formatAmount(entry.amount, entry.unit)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Comentário curto (opcional)" htmlFor="share-note">
                  <Textarea id="share-note" name="note" maxLength={280} rows={2} placeholder="ex.: meta batida sem pressa." />
                </Field>
                <SubmitButton size="sm" variant="secondary" pendingLabel="Compartilhando…">
                  Compartilhar
                </SubmitButton>
              </ActionForm>
            )}
          </Card>

          <Card className="p-5">
            <details>
              <summary className="cursor-pointer text-sm font-semibold text-tomato-deep">
                Criar hábito personalizado
              </summary>
              <ActionForm action={createHabitTypeAction} className="mt-3 space-y-3" resetOnSuccess>
                <Field label="Nome" htmlFor="habit-name">
                  <Input id="habit-name" name="name" required maxLength={40} placeholder="ex.: alongamento" />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Unidade" htmlFor="habit-unit">
                    <Input id="habit-unit" name="unit" required maxLength={12} placeholder="min" />
                  </Field>
                  <Field label="Meta" htmlFor="habit-target">
                    <Input id="habit-target" name="target" type="number" min="0.1" step="0.1" required />
                  </Field>
                </div>
                <SubmitButton size="sm" variant="secondary" pendingLabel="Criando…">
                  Criar hábito
                </SubmitButton>
              </ActionForm>
            </details>
            <p className="mt-3 text-xs text-muted">
              Não defina metas extremas. Se um hábito causar dor, tontura ou
              sofrimento, procure orientação profissional.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
