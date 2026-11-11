import { endOfMonth, startOfMonth, startOfToday, subDays, subMonths } from "date-fns";

export type PeriodPreset = "today" | "7d" | "30d" | "month" | "prev-month" | "all";

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  today: "Hoje",
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  month: "Este mês",
  "prev-month": "Mês passado",
  all: "Tudo",
};

export function periodRange(preset: PeriodPreset): { from: Date | null; to: Date | null } {
  const today = startOfToday();
  switch (preset) {
    case "today":
      return { from: today, to: null };
    case "7d":
      return { from: subDays(today, 7), to: null };
    case "30d":
      return { from: subDays(today, 30), to: null };
    case "month":
      return { from: startOfMonth(today), to: endOfMonth(today) };
    case "prev-month": {
      const prev = subMonths(today, 1);
      return { from: startOfMonth(prev), to: endOfMonth(prev) };
    }
    case "all":
    default:
      return { from: null, to: null };
  }
}
