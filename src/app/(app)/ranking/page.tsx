import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { listCommunitiesForUser } from "@/lib/data/communities";
import { membershipFor } from "@/lib/authz";
import { communityRanking, viewerRankingPosition } from "@/lib/data/points";
import { getProfile } from "@/lib/data/users";
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  Notice,
  PageHeader,
  Select,
} from "@/components/ui/Primitives";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Icon } from "@/components/ui/Icon";
import { setRankingVisibilityAction } from "@/actions/profile";
import { rankWindow, type RankPeriod } from "@/lib/domain/scoring";
import { formatDate, todayIso } from "@/lib/domain/dates";

export const metadata: Metadata = { title: "Ranking" };
export const dynamic = "force-dynamic";

export default async function RankingPage({
  searchParams,
}: {
  searchParams: Promise<{ comunidade?: string; periodo?: string }>;
}) {
  const user = await requireUser("/ranking");
  const params = await searchParams;
  const communities = await listCommunitiesForUser(user.id);
  if (communities.length === 0) {
    return (
      <div>
        <PageHeader eyebrow="Minha comunidade" title="Ranking" />
        <EmptyState
          title="Entre em uma comunidade"
          description="O ranking é sempre de uma comunidade e mostra apenas participação."
          icon="trophy"
        />
      </div>
    );
  }
  const selected =
    communities.find((community) => community.slug === params.comunidade) ?? communities[0];
  const period: RankPeriod = params.periodo === "month" ? "month" : "week";
  const window = rankWindow(period, todayIso());
  const membership = selected ? await membershipFor(user.id, selected.id) : null;
  if (!selected || !membership) {
    return <EmptyState title="Comunidade indisponível" description="Você não participa desta comunidade." icon="lock" />;
  }
  const [rows, position, profile] = await Promise.all([
    communityRanking(selected.id, window.start),
    viewerRankingPosition(selected.id, user.id, window.start),
    getProfile(user.id),
  ]);
  const optedIn = profile?.privacyRank ?? false;

  return (
    <div>
      <PageHeader
        eyebrow="Minha comunidade"
        title="Ranking de participação"
        description="Pontos por hábitos registrados, desafios e apoio. Nunca por exames, diagnóstico, peso ou ausência de doença."
        action={
          <Badge tone="basil">
            <Icon name="trophy" size={12} />
            {window.label}
          </Badge>
        }
      />

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <form method="get" className="flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="ranking-community" className="mb-1 block text-xs font-semibold text-ink-soft">
              Comunidade
            </label>
            <Select id="ranking-community" name="comunidade" defaultValue={selected.slug} className="min-w-52">
              {communities.map((community) => (
                <option key={community.id} value={community.slug}>
                  {community.name}
                </option>
              ))}
            </Select>
          </div>
          <input type="hidden" name="periodo" value={period} />
          <SubmitButton size="sm" variant="secondary" pendingLabel="…">
            Trocar
          </SubmitButton>
        </form>
        <div className="flex gap-1 rounded-full border border-line bg-surface p-1">
          {[
            ["week", "Semana"],
            ["month", "Mês"],
          ].map(([value, label]) => (
            <Link
              key={value}
              href={`/ranking?comunidade=${selected.slug}&periodo=${value}`}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                period === value ? "bg-tomato text-white" : "text-ink-soft hover:bg-surface-soft"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      {!optedIn ? (
        <div className="mb-5">
          <Notice tone="info">
            Você escolheu não aparecer no ranking. Sua pontuação continua sendo
            registrada, mas seu nome fica fora do placar. Você pode mudar isso
            quando quiser.
            <div className="mt-3">
              <ActionForm action={setRankingVisibilityAction} hideMessage>
                <input type="hidden" name="visible" value="1" />
                <SubmitButton size="sm" pendingLabel="…">Entrar no ranking</SubmitButton>
              </ActionForm>
            </div>
          </Notice>
        </div>
      ) : (
        <div className="mb-5">
          <ActionForm action={setRankingVisibilityAction} hideMessage>
            <input type="hidden" name="visible" value="" />
            <SubmitButton size="sm" variant="ghost" pendingLabel="…">
              Sair do ranking
            </SubmitButton>
          </ActionForm>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <div className="border-b border-line bg-surface-soft px-5 py-4">
            <h2 className="text-base font-semibold">{selected.name}</h2>
            <p className="text-xs text-muted">
              {window.label} · desde {formatDate(window.start)} · {rows.length} pessoa{rows.length === 1 ? "" : "s"} no placar
            </p>
          </div>
          {rows.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="Ninguém no placar ainda"
                description="O ranking só mostra quem autorizou aparecer. Registre um hábito para começar."
                icon="trophy"
              />
            </div>
          ) : (
            <ol className="divide-y divide-line">
              {rows.map((row, index) => (
                <li key={row.userId} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      index === 0
                        ? "bg-saffron-soft text-saffron"
                        : index === 1
                          ? "bg-paper-deep text-ink-soft"
                          : index === 2
                            ? "bg-tomato-soft text-tomato-deep"
                            : "text-muted"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <Avatar name={row.name} color={row.avatarColor} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {row.name}
                      {row.userId === user.id ? <span className="ml-1 text-xs font-normal text-muted">(você)</span> : null}
                    </p>
                    <p className="text-[0.65rem] text-muted">{row.entries} lançamento{row.entries === 1 ? "" : "s"} de pontos</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{row.points}</p>
                    <p className="text-[0.6rem] text-muted">pontos</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <aside className="space-y-6">
          <Card className="p-5">
            <h2 className="text-base font-semibold">Sua posição</h2>
            <p className="mt-2 text-3xl font-semibold">
              {position.position ? `#${position.position}` : "—"}
            </p>
            <p className="text-xs text-muted">
              {position.position
                ? `${position.points} pontos entre ${position.total} pessoas no placar.`
                : "Você não aparece no placar desta comunidade."}
            </p>
          </Card>

          <Card className="p-5">
            <h2 className="text-base font-semibold">Como pontuar</h2>
            <ul className="mt-3 space-y-2.5 text-xs text-muted">
              <li className="flex justify-between gap-2"><span>Registrar um hábito</span><span className="font-semibold text-ink">+10</span></li>
              <li className="flex justify-between gap-2"><span>Bater uma meta pessoal</span><span className="font-semibold text-ink">+15</span></li>
              <li className="flex justify-between gap-2"><span>Sequência de 7 dias</span><span className="font-semibold text-ink">+30</span></li>
              <li className="flex justify-between gap-2"><span>Concluir desafio individual</span><span className="font-semibold text-ink">+50</span></li>
              <li className="flex justify-between gap-2"><span>Concluir desafio coletivo</span><span className="font-semibold text-ink">+40</span></li>
              <li className="flex justify-between gap-2"><span>Comentar / reagir</span><span className="font-semibold text-ink">+2 / +1</span></li>
            </ul>
            <p className="mt-3 text-[0.68rem] text-muted">
              Pontos sociais têm teto de 10 por dia. Registros duplicados não geram
              pontos. Datas futuras são bloqueadas.
            </p>
          </Card>

          <Card className="p-5">
            <h2 className="text-base font-semibold">O que o ranking não é</h2>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Não é um atestado de saúde. Não compara exames, corpos ou diagnósticos.
              Não incentiva hidratação excessiva, exercício inseguro ou restrição.
              Se o placar estiver pesando, saia dele.
            </p>
          </Card>

          <p className="text-xs text-muted">
            Semana começa na segunda-feira, no fuso de São Paulo.{" "}
            <Link href="/perfil/privacidade" className="underline">
              Ajustar privacidade
            </Link>
          </p>
        </aside>
      </div>
    </div>
  );
}
