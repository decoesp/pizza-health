import { startOfMonth, startOfWeek, todayIso } from "@/lib/domain/dates";

/** Pontuação por comportamento registrado — nunca por resultado clínico. */
export const POINTS = {
  habitEntry: 10,
  goalDaily: 15,
  streakSeven: 30,
  challengeIndividual: 50,
  challengeCollective: 40,
  comment: 2,
  reaction: 1,
  socialDailyCap: 10,
} as const;

export type RankPeriod = "week" | "month";

export type RankWindow = {
  period: RankPeriod;
  start: string;
  label: string;
};

export function rankWindow(period: RankPeriod, today = todayIso()): RankWindow {
  if (period === "month") {
    return { period, start: startOfMonth(today), label: "Este mês" };
  }
  return { period, start: startOfWeek(today), label: "Esta semana" };
}

export function pointsToNextTier(points: number): { next: number; missing: number } {
  const tiers = [0, 50, 120, 250, 500, 900];
  const next = tiers.find((tier) => tier > points) ?? points;
  return { next, missing: Math.max(0, next - points) };
}

export type RankRow = {
  userId: string;
  name: string;
  avatarColor: string;
  points: number;
  entries: number;
};

/** Ordena por pontos e, no empate, por nome — nunca por dado de saúde. */
export function sortRanking<T extends RankRow>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return a.name.localeCompare(b.name, "pt-BR");
  });
}

export type AchievementCode =
  | "primeiro_registro"
  | "sequencia_7"
  | "constancia_30"
  | "primeiro_documento"
  | "vacinas_em_dia"
  | "primeiro_desafio"
  | "apoio_5"
  | "hidratacao_7";

export const ACHIEVEMENTS: Record<
  AchievementCode,
  { title: string; description: string }
> = {
  primeiro_registro: {
    title: "Primeiro passo",
    description: "Registrou um hábito pela primeira vez.",
  },
  sequencia_7: {
    title: "Sete dias de cuidado",
    description: "Manteve uma sequência de sete dias registrando hábitos.",
  },
  constancia_30: {
    title: "Constância de um mês",
    description: "Chegou a 30 registros de hábitos.",
  },
  primeiro_documento: {
    title: "Arquivo em ordem",
    description: "Organizou o primeiro documento de saúde.",
  },
  vacinas_em_dia: {
    title: "Prevenção anotada",
    description: "Registrou pelo menos uma vacina com comprovante conferido.",
  },
  primeiro_desafio: {
    title: "Entrou no time",
    description: "Participou do primeiro desafio da comunidade.",
  },
  apoio_5: {
    title: "Torcida boa",
    description: "Deixou cinco comentários de apoio em publicações.",
  },
  hidratacao_7: {
    title: "Sete dias de água",
    description: "Registrou hidratação em sete dias seguidos.",
  },
};
