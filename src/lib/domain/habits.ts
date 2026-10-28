export const HABIT_LABELS: Record<string, string> = {
  agua: "Água",
  movimento: "Movimento",
  sono: "Sono",
};

export function habitLabel(slug: string | null | undefined): string {
  if (!slug) return "Hábito";
  return HABIT_LABELS[slug] ?? slug.charAt(0).toUpperCase() + slug.slice(1);
}

export function formatAmount(amount: number, unit: string): string {
  if (unit === "h") {
    return `${amount.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`;
  }
  if (unit === "ml") {
    if (amount >= 1000) {
      return `${(amount / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} L`;
    }
    return `${Math.round(amount)} ml`;
  }
  return `${Math.round(amount)} ${unit}`;
}

export function habitPrompt(unit: string): string {
  if (unit === "ml") return "Quantos ml você bebeu?";
  if (unit === "min") return "Quantos minutos de movimento?";
  if (unit === "h") return "Quantas horas de sono?";
  return "Quanto você registrou?";
}
