import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { listCommunitiesForUser } from "@/lib/data/communities";
import {
  computeProgress,
  listChallengesForUser,
} from "@/lib/data/challenges";
import { listHabitTypes } from "@/lib/data/habits";
import {
  Badge,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  ProgressBar,
  Select,
  Textarea,
} from "@/components/ui/Primitives";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Icon } from "@/components/ui/Icon";
import { createChallengeAction, joinChallengeAction, leaveChallengeAction } from "@/actions/challenges";
import { formatDate, startOfWeek, addDays, todayIso } from "@/lib/domain/dates";
import { habitLabel } from "@/lib/domain/habits";

export const metadata: Metadata = { title: "Desafios" };
export const dynamic = "force-dynamic";

export default async function ChallengesPage() {
  const user = await requireUser("/desafios");
  const [communities, challenges, habits] = await Promise.all([
    listCommunitiesForUser(user.id),
    listChallengesForUser(user.id),
    listHabitTypes(user.id),
  ]);
  const today = todayIso();
  const active = challenges.filter(
    (challenge) => challenge.status === "active" && challenge.startsOn <= today && challenge.endsOn >= today,
  );
  const past = challenges.filter((challenge) => !active.includes(challenge));
  const managed = communities.filter((community) => community.role === "owner" || community.role === "admin");
  const progress = new Map<string, Awaited<ReturnType<typeof computeProgress>>>();
  for (const challenge of active) {
    progress.set(challenge.id, await computeProgress(challenge, user.id));
  }

  return (
    <div>
      <PageHeader
        eyebrow="Minha evolução"
        title="Desafios"
        description="Metas de constância e participação. Nada aqui mede estado clínico ou compara corpos."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <section>
            <h2 className="mb-3 text-lg font-semibold">Em andamento</h2>
            {active.length === 0 ? (
              <EmptyState
                title="Nenhum desafio ativo"
                description="Administradores de comunidade podem criar um desafio de hábitos ou de participação."
                icon="flag"
              />
            ) : (
              <div className="space-y-4">
                {active.map((challenge) => {
                  const item = progress.get(challenge.id);
                  return (
                    <Card key={challenge.id} className="p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold text-muted">
                            {challenge.communityName} · {challenge.kind === "collective" ? "em time" : "individual"}
                          </p>
                          <Link href={`/desafios/${challenge.id}`} className="mt-1 block text-lg font-semibold hover:text-tomato">
                            {challenge.title}
                          </Link>
                          <p className="mt-1 max-w-2xl text-sm text-muted">{challenge.description}</p>
                          <p className="mt-2 text-xs text-muted">
                            {challenge.metric === "habit_days"
                              ? `dias com registro de ${habitLabel(challenge.habitSlug)}`
                              : challenge.metric === "habit_value"
                                ? `total de ${habitLabel(challenge.habitSlug)}`
                                : "pontos de participação"}{" "}
                            · até {formatDate(challenge.endsOn)}
                          </p>
                        </div>
                        <Badge tone={challenge.joined ? "basil" : "neutral"}>
                          {challenge.participantCount} participante{challenge.participantCount === 1 ? "" : "s"}
                        </Badge>
                      </div>

                      <div className="mt-4">
                        <ProgressBar
                          value={item?.value ?? 0}
                          max={challenge.targetValue}
                          tone={item?.complete ? "basil" : "tomato"}
                          label={`${Math.round(item?.value ?? 0)} de ${challenge.targetValue}`}
                        />
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        {challenge.joined ? (
                          <ActionForm action={leaveChallengeAction} hideMessage>
                            <input type="hidden" name="challengeId" value={challenge.id} />
                            <SubmitButton size="sm" variant="ghost" pendingLabel="…">
                              Sair do desafio
                            </SubmitButton>
                          </ActionForm>
                        ) : (
                          <ActionForm action={joinChallengeAction} hideMessage>
                            <input type="hidden" name="challengeId" value={challenge.id} />
                            <SubmitButton size="sm" pendingLabel="…">
                              Participar
                            </SubmitButton>
                          </ActionForm>
                        )}
                        <Link href={`/desafios/${challenge.id}`} className="text-xs font-semibold text-tomato hover:underline">
                          Ver detalhes
                        </Link>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">Histórico</h2>
            {past.length === 0 ? (
              <p className="text-sm text-muted">Nenhum desafio encerrado ainda.</p>
            ) : (
              <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
                {past.slice(0, 10).map((challenge) => (
                  <li key={challenge.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <div>
                      <Link href={`/desafios/${challenge.id}`} className="text-sm font-medium hover:text-tomato">
                        {challenge.title}
                      </Link>
                      <p className="text-xs text-muted">
                        {challenge.communityName} · {formatDate(challenge.startsOn)} a {formatDate(challenge.endsOn)}
                      </p>
                    </div>
                    <Badge tone="neutral">{challenge.status === "ended" ? "encerrado" : "fora do período"}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          {managed.length > 0 ? (
            <Card className="p-5">
              <h2 className="text-base font-semibold">Criar desafio</h2>
              <p className="mt-1 text-xs text-muted">
                Você administra {managed.map((community) => community.name).join(", ")}.
              </p>
              <ActionForm action={createChallengeAction} className="mt-3 space-y-2.5">
                <Field label="Comunidade" htmlFor="challenge-community">
                  <Select id="challenge-community" name="communityId" required>
                    {managed.map((community) => (
                      <option key={community.id} value={community.id}>
                        {community.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Título" htmlFor="challenge-title">
                  <Input id="challenge-title" name="title" required maxLength={100} placeholder="ex.: cinco dias de hidratação" />
                </Field>
                <Field label="Descrição" htmlFor="challenge-description">
                  <Textarea id="challenge-description" name="description" maxLength={600} rows={2} placeholder="Combine o cuidado e o tom do grupo." />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Formato" htmlFor="challenge-kind">
                    <Select id="challenge-kind" name="kind" defaultValue="individual">
                      <option value="individual">Individual</option>
                      <option value="collective">Coletivo</option>
                    </Select>
                  </Field>
                  <Field label="Métrica" htmlFor="challenge-metric">
                    <Select id="challenge-metric" name="metric" defaultValue="habit_days">
                      <option value="habit_days">Dias com registro</option>
                      <option value="habit_value">Soma do hábito</option>
                      <option value="points">Pontos de participação</option>
                    </Select>
                  </Field>
                </div>
                <Field label="Hábito (quando aplicável)" htmlFor="challenge-habit">
                  <Select id="challenge-habit" name="habitSlug" defaultValue="agua">
                    {habits.map((habit) => (
                      <option key={habit.id} value={habit.slug}>
                        {habit.name} ({habit.unit})
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Meta" htmlFor="challenge-target">
                  <Input id="challenge-target" name="target" type="number" min="0.1" step="0.1" required />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Início" htmlFor="challenge-start">
                    <Input id="challenge-start" name="startsOn" type="date" defaultValue={startOfWeek(today)} required />
                  </Field>
                  <Field label="Fim" htmlFor="challenge-end">
                    <Input id="challenge-end" name="endsOn" type="date" defaultValue={addDays(startOfWeek(today), 6)} required />
                  </Field>
                </div>
                <SubmitButton size="sm" pendingLabel="Criando…">Criar desafio</SubmitButton>
              </ActionForm>
            </Card>
          ) : (
            <Card className="p-5">
              <h2 className="text-base font-semibold">Criar desafio</h2>
              <p className="mt-2 text-sm text-muted">
                Apenas proprietários e administradores de comunidade podem criar
                desafios. Peça a alguém da sua comunidade ou crie a sua.
              </p>
            </Card>
          )}

          <Card className="p-5">
            <h2 className="text-base font-semibold">Regras justas</h2>
            <ul className="mt-3 space-y-2.5 text-xs text-muted">
              <li className="flex gap-2"><Icon name="check" size={14} /> Pontos são únicos por registro; não há farm de cliques.</li>
              <li className="flex gap-2"><Icon name="check" size={14} /> Datas futuras são recusadas e o histórico é limitado.</li>
              <li className="flex gap-2"><Icon name="check" size={14} /> Ranking é de participação, nunca de exames ou diagnóstico.</li>
              <li className="flex gap-2"><Icon name="check" size={14} /> Ninguém é obrigado a participar ou aparecer no placar.</li>
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}
