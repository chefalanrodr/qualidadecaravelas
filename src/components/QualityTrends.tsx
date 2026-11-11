import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Activity, Award, Loader2, TrendingDown, TrendingUp } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const SCORE_COLORS = {
  excellent: "#10b981",
  good: "#2563eb",
  attention: "#f59e0b",
  bad: "#ef4444",
  grid: "#e2e8f0",
  axis: "#64748b",
  text: "#0f172a",
};

const AREA_PALETTE = [
  "#2563eb",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
  "#f97316",
  "#14b8a6",
];

function scoreTone(score: number) {
  if (score >= 90) return { label: "Excelente", color: SCORE_COLORS.excellent, bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" };
  if (score >= 80) return { label: "Bom", color: SCORE_COLORS.good, bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" };
  if (score >= 70) return { label: "Atenção", color: SCORE_COLORS.attention, bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" };
  return { label: "Ruim", color: SCORE_COLORS.bad, bg: "bg-red-50", text: "text-red-700", border: "border-red-200" };
}

function formatScore(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(1)}%` : "-";
}

export function QualityTrends() {
  const q = useQuery({
    queryKey: ["q-trends"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quality_audits")
        .select("id, iso_year, iso_week, month, year, score, started_at, status, sectors:quality_audit_sectors(score, sector:quality_sectors(name, area:quality_areas(name)))")
        .eq("status", "concluido")
        .order("started_at", { ascending: true })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const weekly = useMemo(() => {
    const map = new Map<string, { label: string; sort: string; sum: number; n: number }>();
    (q.data ?? []).forEach((audit) => {
      const key = `${audit.iso_year}-${String(audit.iso_week).padStart(2, "0")}`;
      const row = map.get(key) ?? {
        label: `S${audit.iso_week}/${String(audit.iso_year).slice(-2)}`,
        sort: key,
        sum: 0,
        n: 0,
      };
      row.sum += Number(audit.score ?? 0);
      row.n += 1;
      map.set(key, row);
    });
    return [...map.values()]
      .sort((a, b) => a.sort.localeCompare(b.sort))
      .slice(-12)
      .map((row) => ({ label: row.label, score: +(row.sum / row.n).toFixed(1), audits: row.n }));
  }, [q.data]);

  const monthlyByArea = useMemo(() => {
    const map: Record<string, Record<string, { sum: number; n: number }>> = {};
    (q.data ?? []).forEach((a) => {
      const key = `${a.year}-${String(a.month).padStart(2, "0")}`;
      map[key] = map[key] ?? {};
      a.sectors?.forEach((s) => {
        const area = s.sector?.area?.name ?? "—";
        map[key][area] = map[key][area] ?? { sum: 0, n: 0 };
        map[key][area].sum += Number(s.score);
        map[key][area].n++;
      });
    });
    const keys = Object.keys(map).sort().slice(-6);
    const areaSet = new Set<string>();
    keys.forEach((k) => Object.keys(map[k]).forEach((a) => areaSet.add(a)));
    const areas = [...areaSet];
    const rows = keys.map((k) => {
      const [year, month] = k.split("-").map(Number);
      const row: Record<string, number | string> = {
        month: k,
        monthLabel: new Date(year, month - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", ""),
      };
      areas.forEach((a) => {
        const v = map[k][a];
        if (v) row[a] = +(v.sum / v.n).toFixed(1);
      });
      return row;
    });
    return { rows, areas };
  }, [q.data]);

  const latest = weekly[weekly.length - 1];
  const previous = weekly[weekly.length - 2];
  const best = weekly.reduce((acc, item) => (item.score > acc.score ? item : acc), weekly[0] ?? { label: "-", score: 0, audits: 0 });
  const trendDelta = latest && previous ? +(latest.score - previous.score).toFixed(1) : 0;
  const latestTone = scoreTone(latest?.score ?? 0);
  const totalAudits = (q.data ?? []).length;

  if (q.isLoading) {
    return <div className="card-elevated p-6 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground"/></div>;
  }
  if (!weekly.length) return null;

  return (
    <section className="card-elevated p-5 space-y-5 print:hidden">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-primary"/>
        <h2 className="font-bold text-lg">Tendências e histórico</h2>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className={`rounded-lg border p-3 ${latestTone.bg} ${latestTone.border}`}>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <Activity className="h-3.5 w-3.5" />
            Semana atual
          </div>
          <div className={`mt-1 text-2xl font-bold ${latestTone.text}`}>{formatScore(latest?.score)}</div>
          <div className={`text-xs font-semibold ${latestTone.text}`}>{latestTone.label}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            {trendDelta >= 0 ? <TrendingUp className="h-3.5 w-3.5 text-emerald-600" /> : <TrendingDown className="h-3.5 w-3.5 text-red-600" />}
            Variação
          </div>
          <div className={`mt-1 text-2xl font-bold ${trendDelta >= 0 ? "text-emerald-700" : "text-red-700"}`}>
            {previous ? `${trendDelta >= 0 ? "+" : ""}${trendDelta.toFixed(1)}%` : "-"}
          </div>
          <div className="text-xs text-muted-foreground">comparado com a semana anterior</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <Award className="h-3.5 w-3.5 text-amber-500" />
            Melhor semana
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{formatScore(best?.score)}</div>
          <div className="text-xs text-muted-foreground">{best?.label ?? "-"} · {totalAudits} auditoria(s) no histórico</div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pontuação por semana (últimas 12)</div>
            <div className="text-xs text-muted-foreground">Faixas: verde excelente, azul bom, amarelo atenção e vermelho ruim.</div>
          </div>
          <div className="flex flex-wrap gap-1.5 text-[10px] font-semibold">
            <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">90+ excelente</span>
            <span className="rounded-full bg-blue-100 px-2 py-1 text-blue-700">80+ bom</span>
            <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">70+ atenção</span>
            <span className="rounded-full bg-red-100 px-2 py-1 text-red-700">abaixo ruim</span>
          </div>
        </div>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weekly} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
              <defs>
                <linearGradient id="qualityTrendLine" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#2563eb" />
                  <stop offset="60%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#f59e0b" />
                </linearGradient>
              </defs>
              <ReferenceArea y1={90} y2={100} fill="#10b981" fillOpacity={0.08} />
              <ReferenceArea y1={80} y2={90} fill="#2563eb" fillOpacity={0.06} />
              <ReferenceArea y1={70} y2={80} fill="#f59e0b" fillOpacity={0.08} />
              <ReferenceArea y1={0} y2={70} fill="#ef4444" fillOpacity={0.05} />
              <CartesianGrid vertical={false} stroke={SCORE_COLORS.grid}/>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: SCORE_COLORS.axis }} axisLine={false} tickLine={false}/>
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: SCORE_COLORS.axis }} axisLine={false} tickLine={false} tickFormatter={(value) => `${value}%`}/>
              <ReferenceLine y={90} stroke={SCORE_COLORS.excellent} strokeDasharray="4 4" label={{ value: "meta", fill: SCORE_COLORS.excellent, fontSize: 10, position: "insideTopRight" }} />
              <ReferenceLine y={80} stroke={SCORE_COLORS.good} strokeDasharray="4 4" />
              <Tooltip
                formatter={(value, name, item) => {
                  const audits = Number((item as { payload?: { audits?: number } })?.payload?.audits ?? 0);
                  const auditLabel = audits > 0 ? ` (${audits} auditoria${audits > 1 ? "s" : ""})` : "";
                  return [formatScore(value), name === "score" ? `Pontuação${auditLabel}` : name];
                }}
                labelFormatter={(label) => `Semana ${label}`}
                contentStyle={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12, boxShadow: "0 10px 30px rgba(15,23,42,0.12)" }}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="url(#qualityTrendLine)"
                strokeWidth={3}
                dot={{ r: 4, strokeWidth: 2, fill: "#ffffff", stroke: "#2563eb" }}
                activeDot={{ r: 6, strokeWidth: 2, fill: "#10b981", stroke: "#ffffff" }}
                name="Pontuação"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {monthlyByArea.rows.length > 1 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Média mensal por área (últimos 6 meses)</div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyByArea.rows} margin={{ top: 24, right: 12, left: -8, bottom: 0 }} barCategoryGap="18%" barGap={4}>
                <CartesianGrid vertical={false} stroke={SCORE_COLORS.grid}/>
                <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: SCORE_COLORS.axis }} axisLine={false} tickLine={false}/>
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: SCORE_COLORS.axis }} axisLine={false} tickLine={false} tickFormatter={(value) => `${value}%`}/>
                <ReferenceLine y={90} stroke={SCORE_COLORS.excellent} strokeDasharray="4 4" />
                <ReferenceLine y={80} stroke={SCORE_COLORS.good} strokeDasharray="4 4" />
                <Tooltip
                  formatter={(value, name) => [formatScore(value), name]}
                  labelFormatter={(label) => `Mês ${label}`}
                  contentStyle={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12, boxShadow: "0 10px 30px rgba(15,23,42,0.12)" }}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }}/>
                {monthlyByArea.areas.map((a, i) => (
                  <Bar key={a} dataKey={a} fill={AREA_PALETTE[i % AREA_PALETTE.length]} radius={[6, 6, 0, 0]} maxBarSize={46}>
                    {monthlyByArea.areas.length <= 4 && <LabelList dataKey={a} position="top" formatter={formatScore} fontSize={10} fill={SCORE_COLORS.text}/>}
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </section>
  );
}
