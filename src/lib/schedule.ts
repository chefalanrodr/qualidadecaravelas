// Utilidades de agendamento semanal de checklists.
// schedule_days: array de 0..6 (0=domingo). Vazio = todos os dias.

export const WEEKDAYS: { value: number; short: string; long: string }[] = [
  { value: 0, short: "Dom", long: "Domingo" },
  { value: 1, short: "Seg", long: "Segunda" },
  { value: 2, short: "Ter", long: "Terça" },
  { value: 3, short: "Qua", long: "Quarta" },
  { value: 4, short: "Qui", long: "Quinta" },
  { value: 5, short: "Sex", long: "Sexta" },
  { value: 6, short: "Sáb", long: "Sábado" },
];

export function isScheduledFor(
  scheduleDays: number[] | null | undefined,
  date: Date = new Date(),
): boolean {
  if (!scheduleDays || scheduleDays.length === 0) return true;
  return scheduleDays.includes(date.getDay());
}

export function describeSchedule(scheduleDays: number[] | null | undefined): string {
  if (!scheduleDays || scheduleDays.length === 0) return "Todos os dias";
  if (scheduleDays.length === 7) return "Todos os dias";
  const set = new Set(scheduleDays);
  const weekdays = [1, 2, 3, 4, 5].every((d) => set.has(d)) && set.size === 5;
  if (weekdays) return "Seg a Sex";
  const weekend = set.has(0) && set.has(6) && set.size === 2;
  if (weekend) return "Fim de semana";
  return scheduleDays
    .slice()
    .sort((a, b) => a - b)
    .map((d) => WEEKDAYS[d].short)
    .join(", ");
}
