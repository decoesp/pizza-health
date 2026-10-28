import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { membershipFor, isManager } from "@/lib/authz";
import {
  computeProgress,
  evaluateChallengeAwards,
  getChallenge,
  listParticipants,
} from "@/lib/data/challenges";
import { getCommunityById } from "@/lib/data/communities";
import {
  Avatar,
  Badge,
  Card,
  Notice,
  PageHeader,
  ProgressBar,
  Stat,
} from "@/components/ui/Primitives";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { Icon } from "@/components/ui/Icon";
import {
  endChallengeAction,
  joinChallengeAction,
  leaveChallengeAction,
} from "@/actions/challenges";
import { formatDate, todayIso } from "@/lib/domain/dates";
import { habitLabel } from "@/lib/domain/habits";

export const metadata: Metadata = { title: "Desafio" };
export const dynamic = "force-dynamic";

export default async function ChallengeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser("/desafios");
  const { id } = await params;
  const challenge = await getChallenge(id, user.id);
  if (!challenge) notFound();
  const membership = await membershipFor(user.id, challenge.communityId);
  if (!membership) notFound();
  const community = await getCommunityById(challenge.communityId);
  await evaluateChallengeAwards(challenge.id);
  const [progress, participants] = await Promise.all([
    computeProgress(challenge, user.id),
    listParticipants(challenge.id),
  ]);
  const canManage = isManager(membership.role);
  const ended = challenge.endsOn < todayIso();

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow={`${challenge.communityName} · ${challenge.kind === "collective" ? "desafio em time" : "desafio individual"}`}
        title={challenge.title}
        description={challenge.description || "Um combinado de cuidado da comunidade."}
        action={
          <Link href="/desafios" className="text-sm font-semibold text-tomato hover:underline">
            Voltar
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={challenge.status === "ended" || ended ? "neutral" : "basil"}>
                {challenge.status === "ended" || ended ? "encerrado" : "em andamento"}
              </Badge>
              <Badge tone="neutral">{participants.length} participantes</Badge>
              <Badge tone="saffron">
                {challenge.metric === "habit_days"
                  ? `dias de ${habitLabel(challenge.habitSlug)}`
                  : challenge.metric === "habit_value"
                    ? `total de ${habitLabel(challenge.habitSlug)}`
                    : "pontos de participação"}
              </Badge>
            </div>

            <div className="mt-5">
              <ProgressBar
                value={progress.value}
                max={progress.target}
                tone={progress.complete ? "basil" : "tomato"}
                label={`${challenge.kind === "collective" ? "Total do time" : "Seu progresso"}: ${Math.round(progress.value)} de ${progress.target}`}
              />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Stat label="Início" value={formatDate(challenge.startsOn)} icon="calendar" tone="tomato" />
              <Stat label="Fim" value={formatDate(challenge.endsOn)} icon="calendar" tone="saffron" />
              <Stat
                label="Concluído"
                value={progress.complete ? "sim" : "ainda não"}
                hint={challenge.kind === "collective" ? "soma de todos" : "seu registro"}
                icon="target"
                tone={progress.complete ? "basil" : "saffron"}
              />
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {challenge.joined ? (
                <ActionForm action={leaveChallengeAction} hideMessage>
                  <input type="hidden" name="challengeId" value={challenge.id} />
                  <SubmitButton size="sm" variant="secondary" pendingLabel="…">
                    Sair do desafio
                  </SubmitButton>
                </ActionForm>
              ) : (
                <ActionForm action={joinChallengeAction} hideMessage>
                  <input type="hidden" name="challengeId" value={challenge.id} />
                  <SubmitButton size="sm" pendingLabel="…">
                    Participar deste desafio
                  </SubmitButton>
                </ActionForm>
              )}
              {canManage && ended && challenge.status !== "ended" ? (
                <ActionForm action={endChallengeAction} hideMessage>
                  <input type="hidden" name="challengeId" value={challenge.id} />
                  <ConfirmButton
                    message="Encerrar o desafio e avaliar os pontos de quem completou?"
                    variant="secondary"
                    size="sm"
                  >
                    Encerrar e pontuar
                  </ConfirmButton>
                </ActionForm>
              ) : null}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-base font-semibold">Participantes</h2>
            {participants.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Ninguém entrou ainda. Você pode ser a primeira pessoa.</p>
            ) : (
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {participants.map((participant) => (
                  <li key={participant.userId} className="flex items-center gap-2.5 rounded-xl border border-line bg-surface-soft px-3 py-2">
                    <Avatar name={participant.name} color={participant.avatarColor} size={28} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{participant.name}</span>
                    {participant.userId === user.id ? <Badge tone="tomato">você</Badge> : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Notice tone="info">
            O progresso é calculado a partir dos registros de hábitos e pontos já
            existentes. Não há bônus por exagero, restrição ou comportamento de risco.
            A pontuação de desafio é concedida uma única vez por participante.
          </Notice>
        </div>

        <aside className="space-y-6">
          <Card className="p-5">
            <h2 className="text-base font-semibold">Como conta</h2>
            <ul className="mt-3 space-y-2.5 text-xs text-muted">
              {challenge.metric === "habit_days" ? (
                <li className="flex gap-2"><Icon name="check" size={14} /> Cada dia com pelo menos um registro de {habitLabel(challenge.habitSlug)} conta uma vez.</li>
              ) : challenge.metric === "habit_value" ? (
                <li className="flex gap-2"><Icon name="check" size={14} /> Somamos os valores registrados de {habitLabel(challenge.habitSlug)} dentro do período.</li>
              ) : (
                <li className="flex gap-2"><Icon name="check" size={14} /> Somamos os pontos de participação conquistados no período.</li>
              )}
              <li className="flex gap-2"><Icon name="check" size={14} /> Registros futuros são recusados.</li>
              <li className="flex gap-2"><Icon name="check" size={14} /> Editar um registro não duplica pontos.</li>
              <li className="flex gap-2"><Icon name="check" size={14} /> Sair do desafio não apaga pontos já concedidos.</li>
            </ul>
          </Card>

          {community ? (
            <Card className="p-5">
              <h2 className="text-base font-semibold">Comunidade</h2>
              <p className="mt-1 text-sm text-muted">{community.name}</p>
              <Link
                href={`/comunidade/${community.slug}`}
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-tomato hover:underline"
              >
                Abrir feed
                <Icon name="chevron-right" size={14} />
              </Link>
            </Card>
          ) : null}

          <Card className="p-5">
            <h2 className="text-base font-semibold">Cuidado antes do placar</h2>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Se o desafio estiver causando ansiedade, dor ou comportamentos
              excessivos, pare e converse com alguém de confiança ou com um
              profissional. Nenhum ponto vale mais do que a sua segurança.
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
