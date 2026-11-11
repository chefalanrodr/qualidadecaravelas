import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Loader2, Printer, ShieldCheck, TrendingDown, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMemo, useState } from "react";
import { QualityTrends } from "@/components/QualityTrends";
import { RequirePerfil } from "@/components/RequirePerfil";

export const Route = createFileRoute("/_authenticated/quality/reports/")({
  component: () => <RequirePerfil allow={["gestor", "auditor"]}><QualityReports /></RequirePerfil>,
});

function QualityReports() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const q = useQuery({
    queryKey: ["q-reports-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("quality_audits")
        .select("id, iso_year, iso_week, week_of_month, month, year, score, started_at, finished_at, status, sectors:quality_audit_sectors(sector_id, score, sector:quality_sectors(name, area:quality_areas(name)))")
        .eq("status", "concluido")
        .order("started_at", { ascending: false })
        .limit(200);
      if (error) throw error; return data ?? [];
    },
  });

  const audits = q.data ?? [];

  const monthly = useMemo(() => {
    const inMonth = audits.filter((a) => a.year === year && a.month === month);
    if (!inMonth.length) return null;
    const areas: Record<string, { sum: number; n: number; sectors: Record<string, { sum: number; n: number }> }> = {};
    inMonth.forEach((a) => {
      a.sectors?.forEach((s) => {
        const areaName = s.sector?.area?.name ?? "—";
        const secName = s.sector?.name ?? "—";
        areas[areaName] = areas[areaName] ?? { sum: 0, n: 0, sectors: {} };
        areas[areaName].sum += Number(s.score); areas[areaName].n++;
        areas[areaName].sectors[secName] = areas[areaName].sectors[secName] ?? { sum: 0, n: 0 };
        areas[areaName].sectors[secName].sum += Number(s.score);
        areas[areaName].sectors[secName].n++;
      });
    });
    const areaAvg = Object.entries(areas).map(([name, v]) => ({
      name, avg: +(v.sum / v.n).toFixed(1),
      sectors: Object.entries(v.sectors).map(([sn, sv]) => ({ name: sn, avg: +(sv.sum / sv.n).toFixed(1) })).sort((a, b) => a.avg - b.avg),
    }));
    const overall = inMonth.reduce((s, a) => s + Number(a.score), 0) / inMonth.length;
    return { audits: inMonth, areas: areaAvg, overall: +overall.toFixed(1) };
  }, [audits, month, year]);

  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    audits.forEach((a) => set.add(`${a.year}-${a.month}`));
    set.add(`${now.getFullYear()}-${now.getMonth() + 1}`);
    return [...set].map((k) => { const [y, m] = k.split("-").map(Number); return { y, m }; })
      .sort((a, b) => b.y - a.y || b.m - a.m);
  }, [audits]);

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <h1 className="text-2xl font-bold flex items-center gap-2"><ShieldCheck className="w-6 h-6 text-primary"/> Relatórios de Qualidade</h1>
        <p className="text-sm text-muted-foreground">O consolidado mensal se atualiza a cada auditoria concluída. Gere o PDF quando quiser.</p>
      </div>

      <QualityTrends />

      <section className="card-elevated p-5 space-y-3">

        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-muted-foreground">Mês:</label>
            <select
              value={`${year}-${month}`}
              onChange={(e) => { const [y, m] = e.target.value.split("-").map(Number); setYear(y); setMonth(m); }}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
            >
              {monthOptions.map(({ y, m }) => (
                <option key={`${y}-${m}`} value={`${y}-${m}`}>
                  {format(new Date(y, m - 1, 1), "MMMM 'de' yyyy", { locale: ptBR })}
                </option>
              ))}
            </select>
          </div>
          {monthly && (
            <button onClick={() => window.print()} className="rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm font-semibold flex items-center gap-2">
              <Printer className="w-4 h-4"/> Gerar PDF mensal
            </button>
          )}
        </div>

        {!monthly ? (
          <div className="text-sm text-muted-foreground text-center py-6">Nenhuma auditoria concluída neste mês ainda.</div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg">Consolidado de {format(new Date(year, month - 1, 1), "MMMM 'de' yyyy", { locale: ptBR })}</h2>
              <div className="text-3xl font-bold text-primary">{monthly.overall}%</div>
            </div>
            <div className="text-xs text-muted-foreground">Baseado em {monthly.audits.length} auditoria(s) concluída(s)</div>

            <div className="grid gap-3 sm:grid-cols-2">
              {monthly.areas.map((a) => (
                <div key={a.name} className="border border-border rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold">{a.name}</div>
                    <div className={`text-sm font-bold ${a.avg >= 80 ? "text-success" : "text-destructive"}`}>{a.avg}%</div>
                  </div>
                  <ul className="space-y-1">
                    {a.sectors.map((s) => (
                      <li key={s.name} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{s.name}</span>
                        <span className={`font-semibold ${s.avg >= 80 ? "text-success" : "text-destructive"}`}>{s.avg}%</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-border">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Auditorias incluídas</div>
              <ul className="space-y-1">
                {monthly.audits.map((a) => (
                  <li key={a.id} className="flex items-center justify-between text-sm">
                    <span>Semana {a.iso_week} · {a.week_of_month}ª do mês · {format(new Date(a.started_at), "dd/MM", { locale: ptBR })}</span>
                    <span className="font-bold text-primary">{Number(a.score).toFixed(1)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </section>

      <section className="space-y-2 print:hidden">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Auditorias semanais (todas)</h2>
        {q.isLoading ? <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground"/></div> :
          audits.length === 0 ? <div className="card-elevated p-6 text-center text-sm text-muted-foreground">Nenhuma auditoria concluída ainda.</div> :
          <div className="grid gap-2">
            {audits.map((a, idx) => {
              const prev = audits[idx + 1];
              const diff = prev ? Number(a.score) - Number(prev.score) : 0;
              return (
                <Link key={a.id} to="/quality/reports/$id" params={{ id: a.id }} className="card-elevated p-4 flex items-center gap-3 hover:shadow-lg">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary grid place-items-center"><FileText className="w-5 h-5"/></div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">Semana {a.iso_week}/{a.iso_year} — {a.week_of_month}ª do mês</div>
                    <div className="text-xs text-muted-foreground">{format(new Date(a.started_at), "dd/MM/yyyy", { locale: ptBR })}</div>
                  </div>
                  {prev && (
                    <div className={`text-xs font-semibold flex items-center gap-0.5 ${diff >= 0 ? "text-success" : "text-destructive"}`}>
                      {diff >= 0 ? <TrendingUp className="w-3 h-3"/> : <TrendingDown className="w-3 h-3"/>}{Math.abs(diff).toFixed(1)}
                    </div>
                  )}
                  <div className="text-right shrink-0"><div className="text-lg font-bold text-primary">{Number(a.score).toFixed(1)}%</div></div>
                </Link>
              );
            })}
          </div>
        }
      </section>
    </div>
  );
}
