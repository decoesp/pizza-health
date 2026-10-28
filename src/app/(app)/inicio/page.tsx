import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import {
  countDocumentsAwaitingReview,
  countVaccines,
} from "@/lib/data/documents";
import {
  ensureDefaultHabits,
  listEntries,
  listGoals,
  listHabitTypes,
  todayEntries,
  entryDates,
  goalReached,
} from "@/lib/data/habits";
import { listCommunitiesForUser } from "@/lib/data/communities";
import { listFeed, listCommentsForPosts } from "@/lib/data/feed";
import { listChallengesForUser, computeProgress } from "@/lib/data/challenges";
import {
  listAchievements,
  pointsSince,
} from "@/lib/data/points";
import {
  currentStreak,
  formatDate,
  lastNDays,
  startOfWeek,
  todayIso,
} from "@/lib/domain/dates";
import { formatAmount, habitPrompt } from "@/lib/domain/habits";
import { POINTS } from "@/lib/domain/scoring";
import { PageHeader, Badge, Card, Stat, ProgressBar, EmptyState, Avatar } from "@/components/ui/Primitives";
import { ButtonLink } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { WeeklyBars } from "@/components/ui/Charts";
import { PostCard } from "@/components/community/PostCard";
import { saveHabitEntryAction } from "@/actions/habits";

export const metadata: Metadata = { title: "Início" };
export const dynamic = "force-dynamic";

function greeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      hour12: false,
    }).format(new Date()),
  );
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export default async function DashboardPage() {
  const user = await requireUser("/inicio");
  await ensureDefaultHabits(user.id);
  const today = todayIso();
  const weekStart = startOfWeek(today);
  const days = lastNDays(7);

  const [types, entriesToday, communities, goals, weekEntries, achievements, pendingDocs, vaccines] =
    await Promise.all([
      listHabitTypes(user.id),
      todayEntries(user.id),
      listCommunitiesForUser(user.id),
      listGoals(user.id),
      listEntries(user.id, days[0] ?? today, today),
      listAchievements(user.id),
      countDocumentsAwaitingReview(user.id),
      countVaccines(user.id),
    ]);
  const [points, dates, challenges] = await Promise.all([
    pointsSince(user.id, weekStart),
    entryDates(user.id),
    listChallengesForUser(user.id),
  ]);

  const primary = communities[0] ?? null;
  const feed = primary ? await listFeed(primary.id, user.id, 1, 2) : null;
  const comments = feed ? await listCommentsForPosts(feed.posts.map((post) => post.id)) : {};

  const todayByType = new Map(entriesToday.map((entry) => [entry.habitTypeId, entry]));
  const streak = currentStreak(dates, today);
  const totalToday = entriesToday.length;
  const totalGoals = types.length;
  const water = types.find((type) => type.slug === "agua");
  const waterByDay = new Map(
    weekEntries
      .filter((entry) => entry.habitSlug === "agua")
      .map((entry) => [entry.entryDate, entry.amount]),
  );
  const waterData = days.map((day) => ({
    label: formatDate(day).slice(0, 2),
    value: waterByDay.get(day) ?? 0,
  }));

  const activeChallenges = challenges
    .filter(
      (challenge) =>
        challenge.status === "active" &&
        challenge.startsOn <= today &&
        challenge.endsOn >= today,
    )
    .slice(0, 3);
  const challengeProgress = [];
  for (const challenge of activeChallenges) {
    challengeProgress.push({ challenge, progress: await computeProgress(challenge, user.id) });
  }

  return (
    <div>
      <PageHeader
        eyebrow={formatDate(today)}
        title={`${greeting()}, ${user.name.split(/\s+/)[0]}.`}
        description="Um registro de cada vez. O suficiente para hoje já conta."
        action={
          <ButtonLink href="/habitos" variant="secondary" size="sm">
            <Icon name="plus" size={15} />
            Registrar hábito
          </ButtonLink>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Hábitos hoje"
          value={`${totalToday}/${totalGoals}`}
          hint={streak > 0 ? `sequência de ${streak} dia${streak === 1 ? "" : "s"}` : "comece pelo mais fácil"}
          icon="activity"
          tone="tomato"
        />
        <Stat
          label="Água hoje"
          value={
            todayByType.get(water?.id ?? "")
              ? formatAmount(todayByType.get(water?.id ?? "")?.amount ?? 0, "ml")
              : "—"
          }
          hint={water ? `meta ${formatAmount(water.targetValue, "ml")}` : undefined}
          icon="drop"
          tone="sky"
        />
        <Stat
          label="Pontos na semana"
          value={points}
          hint={`${POINTS.habitEntry} por registro, sem duplicar`}
          icon="trophy"
          tone="saffron"
        />
        <Stat
          label="Pendências"
          value={pendingDocs}
          hint={vaccines > 0 ? `${vaccines} vacina${vaccines === 1 ? "" : "s"} registrada${vaccines === 1 ? "" : "s"}` : "documentos para revisar"}
          icon="file"
          tone="basil"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card className="p-5">
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Registro rápido</h2>
                <p className="text-sm text-muted">Um toque para manter o fio do dia.</p>
              </div>
              <Link href="/habitos" className="text-xs font-semibold text-tomato hover:underline">
                Ver histórico
              </Link>
            </div>

            {types.length === 0 ? (
              <EmptyState
                title="Nenhum hábito ativo"
                description="Crie seu primeiro hábito para começar o diário."
                icon="activity"
                action={<ButtonLink href="/habitos">Criar hábito</ButtonLink>}
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                {types.map((type) => {
                  const entry = todayByType.get(type.id);
                  const iconName = (type.icon as IconName) ?? "spark";
                  return (
                    <div key={type.id} className="rounded-xl border border-line bg-surface-soft p-3.5">
                      <div className="flex items-center justify-between">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-tomato-soft text-tomato">
                          <Icon name={iconName} size={16} />
                        </span>
                        {entry ? (
                          <Badge tone="basil">
                            <Icon name="check" size={11} />
                            feito
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm font-semibold">{type.name}</p>
                      <p className="text-xs text-muted">
                        {entry
                          ? `${formatAmount(entry.amount, type.unit)} registrado`
                          : `meta ${formatAmount(type.targetValue, type.unit)}`}
                      </p>
                      <ActionForm
                        action={saveHabitEntryAction}
                        className="mt-2.5 space-y-2"
                        resetOnSuccess
                        hideMessage
                      >
                        <input type="hidden" name="habitTypeId" value={type.id} />
                        <input type="hidden" name="date" value={today} />
                        <label htmlFor={`quick-${type.id}`} className="sr-only">
                          {habitPrompt(type.unit)}
                        </label>
                        <input
                          id={`quick-${type.id}`}
                          name="amount"
                          type="number"
                          min="0.1"
                          step="0.1"
                          required
                          defaultValue={entry?.amount ?? ""}
                          placeholder={String(type.targetValue)}
                          className="w-full rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 text-sm focus:border-tomato focus:outline-none focus:ring-2 focus:ring-tomato/20"
                        />
                        <SubmitButton variant={entry ? "secondary" : "soft"} size="sm" className="w-full" pendingLabel="Salvando…">
                          {entry ? "Atualizar" : "Registrar"}
                        </SubmitButton>
                      </ActionForm>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-semibold">Água nos últimos 7 dias</h2>
                <Badge tone="sky">hidratação</Badge>
              </div>
              <WeeklyBars
                data={waterData}
                target={water?.targetValue}
                unit="ml"
                tone="sky"
                title="Água registrada nos últimos sete dias"
              />
            </Card>

            <Card className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-semibold">Suas metas</h2>
                <Link href="/habitos" className="text-xs font-semibold text-tomato hover:underline">
                  Gerenciar
                </Link>
              </div>
              {goals.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line-strong bg-surface-soft p-4 text-sm text-muted">
                  Nenhuma meta pessoal ativa. Definir uma meta ajuda a dar contexto
                  ao registro — sem virar cobrança.
                </p>
              ) : (
                <ul className="space-y-4">
                  {goals.slice(0, 3).map((goal) => {
                    const relevant = weekEntries.filter(
                      (entry) =>
                        entry.habitTypeId === goal.habitTypeId &&
                        entry.entryDate >= (goal.period === "weekly" ? weekStart : today),
                    );
                    const total = relevant.reduce((sum, entry) => sum + entry.amount, 0);
                    return (
                      <li key={goal.id}>
                        <div className="mb-1 flex justify-between gap-2 text-sm">
                          <span className="font-medium">{goal.title}</span>
                          <span className="text-xs text-muted">
                            {formatAmount(total, goal.unit)} / {formatAmount(goal.targetValue, goal.unit)}
                          </span>
                        </div>
                        <ProgressBar
                          value={total}
                          max={goal.targetValue}
                          tone={goalReached(total, goal.targetValue) ? "basil" : "tomato"}
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>

          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">
                  {primary ? primary.name : "Sua comunidade"}
                </h2>
                <p className="text-sm text-muted">
                  {primary
                    ? `${primary.memberCount} pessoa${primary.memberCount === 1 ? "" : "s"} cuidando junto`
                    : "Crie ou entre em uma comunidade para começar."}
                </p>
              </div>
              {primary ? (
                <ButtonLink href={`/comunidade/${primary.slug}`} variant="secondary" size="sm">
                  Abrir feed
                </ButtonLink>
              ) : (
                <ButtonLink href="/comunidade" size="sm">
                  Comunidades
                </ButtonLink>
              )}
            </div>
            {feed && feed.posts.length > 0 ? (
              <div className="space-y-4">
                {feed.posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    comments={comments[post.id] ?? []}
                    communitySlug={primary?.slug ?? ""}
                    viewerId={user.id}
                    canModerate={primary?.role === "owner" || primary?.role === "admin"}
                    showComments={false}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title="O feed está quieto"
                description="Compartilhe um hábito ou escreva um incentivo para a turma."
                icon="users"
                action={primary ? <ButtonLink href={`/comunidade/${primary.slug}`}>Ir para a comunidade</ButtonLink> : null}
              />
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">Desafios ativos</h2>
              <Link href="/desafios" className="text-xs font-semibold text-tomato hover:underline">
                Todos
              </Link>
            </div>
            {challengeProgress.length === 0 ? (
              <p className="text-sm text-muted">
                Nenhum desafio em andamento nas suas comunidades.
              </p>
            ) : (
              <ul className="space-y-4">
                {challengeProgress.map(({ challenge, progress }) => (
                  <li key={challenge.id}>
                    <Link href={`/desafios/${challenge.id}`} className="text-sm font-semibold hover:text-tomato">
                      {challenge.title}
                    </Link>
                    <p className="text-xs text-muted">
                      {challenge.kind === "collective" ? "em time" : "individual"} · até {formatDate(challenge.endsOn)}
                    </p>
                    <div className="mt-2">
                      <ProgressBar
                        value={progress.value}
                        max={progress.target}
                        tone={progress.complete ? "basil" : "tomato"}
                        label={`${Math.round(progress.value)} de ${progress.target}`}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">Conquistas</h2>
              <Link href="/perfil/conquistas" className="text-xs font-semibold text-tomato hover:underline">
                Ver todas
              </Link>
            </div>
            {achievements.length === 0 ? (
              <p className="text-sm text-muted">
                Sua primeira conquista aparece com o primeiro registro.
              </p>
            ) : (
              <ul className="space-y-3">
                {achievements.slice(0, 3).map((achievement) => (
                  <li key={achievement.code} className="flex gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-saffron-soft text-saffron">
                      <Icon name="trophy" size={16} />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{achievement.title}</p>
                      <p className="text-xs text-muted">{achievement.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="text-base font-semibold">Atalhos de cuidado</h2>
            <div className="mt-3 space-y-2">
              {([
                ["/exames", "Central de exames", "file", `${pendingDocs} aguardando revisão`],
                ["/vacinas", "Vacinas", "shield", `${vaccines} registradas`],
                ["/ranking", "Ranking da comunidade", "trophy", "só hábitos e participação"],
                ["/perfil/privacidade", "Privacidade", "lock", "controle o que compartilha"],
              ] as const).map(([href, label, icon, hint]) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5 hover:bg-surface-soft"
                >
                  <span className="text-tomato">
                    <Icon name={icon as IconName} size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{label}</span>
                    <span className="block text-xs text-muted">{hint}</span>
                  </span>
                  <Icon name="chevron-right" size={15} className="text-muted" />
                </Link>
              ))}
            </div>
          </Card>

          {primary ? (
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Sua turma</h2>
                <Link href={`/comunidade/${primary.slug}/membros`} className="text-xs font-semibold text-tomato hover:underline">
                  Ver membros
                </Link>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Avatar name={user.name} color={user.avatarColor} size={30} />
                {Array.from({ length: Math.min(4, Math.max(0, primary.memberCount - 1)) }).map((_, index) => (
                  <span
                    key={index}
                    className="flex h-[30px] w-[30px] items-center justify-center rounded-full border border-dashed border-line-strong text-[0.6rem] text-muted"
                  >
                    <Icon name="user" size={13} />
                  </span>
                ))}
                {primary.memberCount > 5 ? (
                  <span className="flex h-[30px] items-center rounded-full bg-paper-deep px-2 text-[0.62rem] font-semibold text-muted">
                    +{primary.memberCount - 5}
                  </span>
                ) : null}
              </div>
              <p className="mt-3 text-xs text-muted">
                Você só vê o que cada pessoa escolheu compartilhar. Exames e
                vacinas ficam privados por padrão.
              </p>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
