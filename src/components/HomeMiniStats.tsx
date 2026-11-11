import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays, startOfDay } from "date-fns";
import { Loader2 } from "lucide-react";

function scoreColor(v: number) {
  if (v >= 85) return "text-success";
  if (v >= 70) return "text-primary";
  if (v >= 50) return "text-warning";
  return "text-destructive";
}

export function HomeMiniStats() {
  const q = useQuery({
    queryKey: ["home-mini-stats"],
    staleTime: 60_000,
    queryFn: async () => {
      const since = subDays(startOfDay(new Date()), 7).toISOString();
      const [execs, ncs, plans] = await Promise.all([
        supabase
          .from("checklist_executions")
          .select("id, score, status")
          .gte("started_at", since),
        supabase
          .from("checklist_answers")
          .select("id, item:checklist_items(is_critical)")
          .eq("status", "nao_conforme")
          .gte("answered_at", since),
        supabase
          .from("action_plans")
          .select("id, status, due_date")
          .not("status", "in", "(concluido,cancelado)"),
      ]);
      const done = (execs.data ?? []).filter((e) => e.status === "concluido");
      const avg = done.length
        ? +(done.reduce((s, e) => s + (Number(e.score) || 0), 0) / done.length).toFixed(1)
        : 0;
      const criticalNcs = (ncs.data ?? []).filter(
        (n) => (n as { item?: { is_critical?: boolean } | null }).item?.is_critical,
      ).length;
      const overduePlans = (plans.data ?? []).filter(
        (p) => p.due_date && new Date(p.due_date) < new Date(),
      ).length;
      return { total: execs.data?.length ?? 0, avg, criticalNcs, overduePlans };
    },
  });

  if (q.isLoading) {
    return (
      <div className="card-elevated p-6 grid place-items-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  const s = q.data!;

  return (
    <div className="card-elevated p-5 sm:p-6 relative overflow-hidden">
      <div
        className="absolute -top-20 -right-20 w-56 h-56 rounded-full opacity-60 blur-3xl pointer-events-none"
        style={{ background: "var(--gradient-primary)" }}
      />
      <div className="relative">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
          Últimos 7 dias
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <div className="font-display text-5xl sm:text-6xl font-bold tabular-nums leading-none">
            {s.total}
          </div>
          <div className="text-sm text-muted-foreground">checklists</div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-4">
          <Mini label="Score médio" value={`${s.avg}%`} tone={scoreColor(s.avg)} />
          <Mini label="NCs críticas" value={s.criticalNcs} tone={s.criticalNcs > 0 ? "text-destructive" : "text-muted-foreground"} />
          <Mini label="Planos" sub="vencidos" value={s.overduePlans} tone={s.overduePlans > 0 ? "text-warning" : "text-muted-foreground"} />
        </div>
      </div>
    </div>
  );
}

function Mini({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
      <div className={`mt-1 font-display text-2xl font-bold tabular-nums leading-none ${tone}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}
