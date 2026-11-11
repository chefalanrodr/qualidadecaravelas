import { Search, X } from "lucide-react";
import { PERIOD_LABELS, type PeriodPreset } from "@/lib/date-presets";

export type FiltersValue = {
  period: PeriodPreset;
  search: string;
  sector: string;
};

export function ReportsFilters({
  value,
  onChange,
  sectors,
}: {
  value: FiltersValue;
  onChange: (v: FiltersValue) => void;
  sectors: string[];
}) {
  const hasActive = value.period !== "30d" || value.search !== "" || value.sector !== "";
  return (
    <div className="card-elevated p-3 space-y-3">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(PERIOD_LABELS) as PeriodPreset[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange({ ...value, period: p })}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              value.period === p
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:border-primary/40"
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_200px_auto]">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={value.search}
            onChange={(e) => onChange({ ...value, search: e.target.value })}
            placeholder="Buscar por nome…"
            className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2 text-sm"
          />
        </div>
        {sectors.length > 0 && (
          <select
            value={value.sector}
            onChange={(e) => onChange({ ...value, sector: e.target.value })}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Todos os setores</option>
            {sectors.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}
        {hasActive && (
          <button
            type="button"
            onClick={() => onChange({ period: "30d", search: "", sector: "" })}
            className="inline-flex items-center justify-center gap-1 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            <X className="w-3.5 h-3.5" /> Limpar
          </button>
        )}
      </div>
    </div>
  );
}
