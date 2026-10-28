import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getCommunityBySlug, getMember, getMemberActivity } from "@/lib/data/communities";
import { canViewSharedCategory, membershipFor } from "@/lib/authz";
import { listEntries, listHabitTypes } from "@/lib/data/habits";
import { listDocumentsSharedWithCommunity, listVaccines } from "@/lib/data/documents";
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  Notice,
  PageHeader,
} from "@/components/ui/Primitives";
import { Icon } from "@/components/ui/Icon";
import { currentStreak, formatDate, lastNDays, todayIso } from "@/lib/domain/dates";
import { formatAmount } from "@/lib/domain/habits";

export const metadata: Metadata = { title: "Perfil do membro" };
export const dynamic = "force-dynamic";

const ROLE_LABEL = { owner: "proprietário", admin: "administrador", member: "membro" } as const;

export default async function MemberProfilePage({
  params,
}: {
  params: Promise<{ slug: string; userId: string }>;
}) {
  const viewer = await requireUser("/comunidade");
  const { slug, userId } = await params;
  const community = await getCommunityBySlug(slug);
  if (!community) notFound();
  const viewerMembership = await membershipFor(viewer.id, community.id);
  if (!viewerMembership) notFound();
  const member = await getMember(community.id, userId);
  if (!member) notFound();

  const [profileShared, habitsShared, vaccinesShared, examsShared, activity] =
    await Promise.all([
      canViewSharedCategory(viewer.id, member.userId, community.id, "profile"),
      canViewSharedCategory(viewer.id, member.userId, community.id, "habits"),
      canViewSharedCategory(viewer.id, member.userId, community.id, "vaccines"),
      canViewSharedCategory(viewer.id, member.userId, community.id, "exams"),
      getMemberActivity(community.id, member.userId),
    ]);

  const [habitTypes, entries, vaccines, documents] = await Promise.all([
    habitsShared ? listHabitTypes(member.userId) : Promise.resolve([]),
    habitsShared ? listEntries(member.userId, lastNDays(7)[0] ?? todayIso(), todayIso()) : Promise.resolve([]),
    vaccinesShared ? listVaccines(member.userId) : Promise.resolve([]),
    examsShared ? listDocumentsSharedWithCommunity(member.userId, community.id) : Promise.resolve([]),
  ]);

  const habitSummary = habitTypes.map((type) => {
    const list = entries.filter((entry) => entry.habitTypeId === type.id);
    return {
      ...type,
      days: list.length,
      total: list.reduce((sum, entry) => sum + entry.amount, 0),
      streak: currentStreak(list.map((entry) => entry.entryDate)),
    };
  });
  const confirmedVaccines = vaccines.filter((vaccine) => vaccine.status === "confirmed");

  return (
    <div>
      <PageHeader
        eyebrow={community.name}
        title={member.name}
        description={member.bio ?? "Este membro ainda não escreveu uma bio."}
        action={
          <Link href={`/comunidade/${community.slug}/membros`} className="text-sm font-semibold text-tomato hover:underline">
            Voltar aos membros
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <Avatar name={member.name} color={member.avatarColor} size={54} />
              <div>
                <p className="font-semibold">{member.name}</p>
                <p className="text-xs text-muted">{ROLE_LABEL[member.role]}</p>
              </div>
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Na comunidade desde</dt>
                <dd>{formatDate(member.joinedAt.slice(0, 10))}</dd>
              </div>
              {profileShared && member.city ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-muted">Cidade</dt>
                  <dd>{member.city}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Hábitos (30 dias)</dt>
                <dd>{profileShared ? activity.habitEntries : "não compartilhado"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Publicações</dt>
                <dd>{profileShared ? activity.posts : "não compartilhado"}</dd>
              </div>
            </dl>
            <div className="mt-4 flex flex-wrap gap-1.5">
              <Badge tone={profileShared ? "basil" : "neutral"}>
                <Icon name={profileShared ? "eye" : "lock"} size={11} />
                perfil {profileShared ? "compartilhado" : "privado"}
              </Badge>
              <Badge tone={habitsShared ? "basil" : "neutral"}>
                <Icon name={habitsShared ? "eye" : "lock"} size={11} />
                hábitos
              </Badge>
              <Badge tone={vaccinesShared ? "basil" : "neutral"}>
                <Icon name={vaccinesShared ? "eye" : "lock"} size={11} />
                vacinas
              </Badge>
              <Badge tone={examsShared ? "basil" : "neutral"}>
                <Icon name={examsShared ? "eye" : "lock"} size={11} />
                exames
              </Badge>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-base font-semibold">Respeito primeiro</h2>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Dados de saúde são sensíveis. Não use esta página para cobrar
              resultados, comparar corpos ou tirar conclusões clínicas. O que
              aparece aqui foi autorizado pela pessoa e pode ser revogado a
              qualquer momento.
            </p>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Icon name="activity" size={17} className="text-tomato" />
              Hábitos compartilhados
            </h2>
            {!habitsShared ? (
              <div className="mt-3">
                <Notice tone="info">Esta pessoa não compartilha hábitos com a comunidade.</Notice>
              </div>
            ) : habitSummary.length === 0 ? (
              <EmptyState title="Sem registros recentes" description="Nenhum hábito registrado nos últimos 7 dias." icon="activity" />
            ) : (
              <div className="mt-3 space-y-3">
                {habitSummary.map((habit) => (
                  <div key={habit.id} className="rounded-xl border border-line bg-surface-soft p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{habit.name}</p>
                      <p className="text-xs text-muted">
                        sequência {habit.streak} dia{habit.streak === 1 ? "" : "s"}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {habit.days} de 7 dias · total {formatAmount(habit.total, habit.unit)}
                    </p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-paper-deep">
                      <div
                        className="h-full rounded-full bg-tomato"
                        style={{ width: `${Math.min(100, (habit.days / 7) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
                <p className="text-[0.68rem] text-muted">
                  Última atualização considerada: {formatDate(todayIso())}. O histórico
                  completo não é exibido para terceiros.
                </p>
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Icon name="shield" size={17} className="text-tomato" />
              Vacinas compartilhadas
            </h2>
            {!vaccinesShared ? (
              <div className="mt-3">
                <Notice tone="info">Esta pessoa não compartilha vacinas com a comunidade.</Notice>
              </div>
            ) : confirmedVaccines.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Nenhuma vacina confirmada para exibir.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {confirmedVaccines.map((vaccine) => (
                  <li key={vaccine.id} className="py-2.5">
                    <p className="text-sm font-medium">
                      {vaccine.name} {vaccine.doseLabel ? `· ${vaccine.doseLabel}` : ""}
                    </p>
                    <p className="text-xs text-muted">
                      {formatDate(vaccine.appliedOn)}
                      {vaccine.location ? ` · ${vaccine.location}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {vaccines.some((vaccine) => vaccine.status === "pending") ? (
              <p className="mt-2 text-xs text-muted">
                Há registros pendentes de conferência que não são exibidos como confirmados.
              </p>
            ) : null}
          </Card>

          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Icon name="file" size={17} className="text-tomato" />
              Documentos compartilhados
            </h2>
            {!examsShared ? (
              <div className="mt-3">
                <Notice tone="info">Esta pessoa não compartilha exames com a comunidade.</Notice>
              </div>
            ) : documents.length === 0 ? (
              <p className="mt-3 text-sm text-muted">
                Nenhum documento compartilhado individualmente com esta comunidade.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {documents.map((document) => (
                  <li key={document.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium">{document.title}</p>
                      <p className="text-xs text-muted">
                        {formatDate(document.collectedOn ?? document.createdAt.slice(0, 10))}
                        {document.labName ? ` · ${document.labName}` : ""}
                      </p>
                    </div>
                    <a
                      href={`/api/documents/${document.id}/download`}
                      className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold hover:bg-surface-soft"
                    >
                      Baixar
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-[0.68rem] text-muted">
              Resultados estruturados permanecem privados. O compartilhamento é
              sempre por documento.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
