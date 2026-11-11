// Quality helpers: ISO week and week-of-month for a given date.
export function isoWeek(d: Date): { year: number; week: number } {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((+date - +yearStart) / 86400000 + 1) / 7);
  return { year: date.getUTCFullYear(), week };
}

export function weekOfMonth(d: Date): number {
  // 1..5 based on the ISO week index within the month of the date's Thursday
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7; // Monday=0
  return Math.ceil((d.getDate() + offset) / 7);
}

export type AnswerStatus = "conforme" | "nao_conforme" | "nao_aplicavel";

export function scoreSector(
  items: Array<{ id: string; weight: number }>,
  answers: Record<string, { answer: AnswerStatus }>,
): { score: number; conform: number; nc: number; na: number; total: number; conformWeight: number; possibleWeight: number } {
  let possibleWeight = 0, conformWeight = 0, c = 0, nc = 0, na = 0;
  items.forEach((it) => {
    const a = answers[it.id]?.answer;
    if (!a) return;
    if (a === "nao_aplicavel") { na++; return; }
    possibleWeight += Number(it.weight);
    if (a === "conforme") { conformWeight += Number(it.weight); c++; } else { nc++; }
  });
  return {
    score: possibleWeight ? +((conformWeight / possibleWeight) * 100).toFixed(2) : 0,
    conform: c, nc, na, total: items.length, conformWeight, possibleWeight,
  };
}

export type ScoreBands = { excelente: number; bom: number; atencao: number };
export const DEFAULT_BANDS: ScoreBands = { excelente: 90, bom: 80, atencao: 70 };

export type ScoreLevel = "excelente" | "bom" | "atencao" | "ruim";

export function classifyScore(score: number, bands: ScoreBands = DEFAULT_BANDS): {
  level: ScoreLevel; label: string; className: string;
} {
  if (score >= bands.excelente) return { level: "excelente", label: "Excelente", className: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" };
  if (score >= bands.bom) return { level: "bom", label: "Bom", className: "bg-sky-500/15 text-sky-600 border-sky-500/30" };
  if (score >= bands.atencao) return { level: "atencao", label: "Atenção", className: "bg-amber-500/15 text-amber-600 border-amber-500/30" };
  return { level: "ruim", label: "Ruim", className: "bg-destructive/15 text-destructive border-destructive/30" };
}

export function parseBands(raw: unknown): ScoreBands {
  const b = (raw ?? {}) as Partial<ScoreBands>;
  return {
    excelente: Number(b.excelente ?? DEFAULT_BANDS.excelente),
    bom: Number(b.bom ?? DEFAULT_BANDS.bom),
    atencao: Number(b.atencao ?? DEFAULT_BANDS.atencao),
  };
}
