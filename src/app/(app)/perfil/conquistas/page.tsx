import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { listAchievements, pointsTotal } from "@/lib/data/points";
import { ACHIEVEMENTS, type AchievementCode } from "@/lib/domain/scoring";
import { Badge, Card, PageHeader } from "@/components/ui/Primitives";
import { Icon } from "@/components/ui/Icon";
import { formatDate } from "@/lib/domain/dates";

export const metadata: Metadata = { title: "Conquistas" };
export const dynamic = "force-dynamic";

export default async function AchievementsPage() {
  const user = await requireUser("/perfil/conquistas");
  const [earned, points] = await Promise.all([
    listAchievements(user.id),
    pointsTotal(user.id),
  ]);
  const earnedMap = new Map(earned.map((achievement) => [achievement.code, achievement]));
  const definitions = Object.entries(ACHIEVEMENTS) as Array<
    [AchievementCode, { title: string; description: string }]
  >;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow="Minha evolução"
        title="Conquistas"
        description="Marcos de constância e cuidado. Nenhuma conquista depende de resultado de exame ou de estado clínico."
        action={
          <Link href="/perfil" className="text-sm font-semibold text-tomato hover:underline">
            Voltar ao perfil
          </Link>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-saffron-soft text-saffron">
          <Icon name="trophy" size={19} />
        </span>
        <div>
          <p className="text-sm font-semibold">
            {earned.length} de {definitions.length} conquistas
          </p>
          <p className="text-xs text-muted">{points} pontos acumulados</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {definitions.map(([code, definition]) => {
          const achievement = earnedMap.get(code);
          return (
            <Card
              key={code}
              className={`p-5 ${achievement ? "" : "bg-surface-soft opacity-80"}`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                    achievement ? "bg-saffron-soft text-saffron" : "bg-paper-deep text-muted"
                  }`}
                >
                  <Icon name={achievement ? "trophy" : "lock"} size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-semibold">{definition.title}</h2>
                    {achievement ? <Badge tone="basil">conquistada</Badge> : <Badge tone="neutral">a caminho</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-muted">{definition.description}</p>
                  {achievement ? (
                    <p className="mt-2 text-[0.65rem] text-muted">
                      em {formatDate(achievement.earnedAt.slice(0, 10))}
                    </p>
                  ) : null}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <p className="mt-6 text-xs text-muted">
        Conquistas são concedidas uma única vez. Elas não alteram o ranking de exames
        porque esse ranking não existe.
      </p>
    </div>
  );
}
