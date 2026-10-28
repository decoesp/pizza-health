export const APP_TIME_ZONE = "America/Sao_Paulo";

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const longDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "UTC",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const weekdayFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "UTC",
  weekday: "short",
});

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: APP_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Data de hoje no fuso da comunidade, no formato YYYY-MM-DD. */
export function todayIso(): string {
  return dateFormatter.format(new Date());
}

export function isoDate(date: Date): string {
  return dateFormatter.format(date);
}

export function addDays(date: string, days: number): string {
  const parsed = new Date(`${date}T12:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T12:00:00Z`).getTime();
  const b = new Date(`${to}T12:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** Segunda-feira da semana da data informada. */
export function startOfWeek(date: string): string {
  const parsed = new Date(`${date}T12:00:00Z`);
  const day = parsed.getUTCDay();
  const delta = day === 0 ? -6 : 1 - day;
  return addDays(date, delta);
}

export function startOfMonth(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

export function lastNDays(count: number, end = todayIso()): string[] {
  return Array.from({ length: count }, (_, index) => addDays(end, index - count + 1));
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return "—";
  return longDateFormatter.format(date).replace(".", "");
}

export function formatWeekday(iso: string): string {
  const date = new Date(`${iso}T12:00:00Z`);
  return weekdayFormatter.format(date).replace(".", "");
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return dateTimeFormatter.format(date);
}

export function relativeTime(iso: string): string {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return "";
  const diff = Date.now() - time;
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return "ontem";
  if (days < 30) return `há ${days} dias`;
  return formatDate(iso.slice(0, 10));
}

/**
 * Sequência de dias consecutivos com registro, terminando hoje ou ontem.
 * Um dia sem registro encerra a sequência; não há "compensação" retroativa.
 */
export function currentStreak(dates: string[], today = todayIso()): number {
  const unique = new Set(dates.filter((date) => date <= today));
  let cursor = unique.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (unique.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function isWithin(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

/** Comparação de expiração fora do corpo de renderização. */
export function isExpired(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const time = new Date(iso).getTime();
  return Number.isFinite(time) && time <= Date.now();
}
