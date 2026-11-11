import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  ChevronRight,
  Loader2,
  PlayCircle,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { differenceInCalendarDays, format, startOfDay, subDays, eachDayOfInterval } from "date-fns";
import { isScheduledFor } from "@/lib/schedule";
import { ptBR } from "date-fns/locale";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Area,
  AreaChart,
} from "recharts";

import { RequirePerfil } from "@/components/RequirePerfil";
import { usePerfil } from "@/lib/perfil";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: () => <RequirePerfil allow={["operador","gestor","auditor"]}><DashboardPage /></RequirePerfil>,
});

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function DashboardPage() {
  const [name, setName] = useState<string>("");
  const [periodDays, setPeriodDays] = useState<7 | 30 | 90>(30);
  const [filterOpen, setFilterOpen] = useState(false);
  const { canRunChecklist, canRunQualityAudit, canViewActionPlans } = usePerfil();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const meta = data.user?.user_metadata as { full_name?: string } | undefined;
      setName(meta?.full_name?.split(" ")[0] ?? data.user?.email?.split("@")[0] ?? "");
    });
  }, []);

  const q = useQuery({
    queryKey: ["dashboard-konklui", periodDays],
    staleTime: 60_000,
    queryFn: async () => {
      const since = subDays(new Date(), periodDays);
      const sinceIso = since.toISOString();

      const [execs, ncs, plans] = await Promise.all([
        supabase
          .from("checklist_executions")
          .select("id, score, status, started_at, finished_at, template:checklist_templates(name, sector:sectors(name))")
          .gte("started_at", sinceIso)
          .order("started_at", { ascending: false }),
        supabase
          .from("checklist_answers")
          .select("id, item:checklist_items(is_critical, name), answered_at")
          .eq("status", "nao_conforme")
          .gte("answered_at", sinceIso),
        supabase.from("action_plans").select("id, status, due_date"),
      ]);

      return {
        since,
        executions: execs.data ?? [],
        ncs: ncs.data ?? [],
        plans: plans.data ?? [],
      };
    },
  });


  const pendingQ = useQuery({
    queryKey: ["dashboard-pending"],
    staleTime: 60_000,
    queryFn: async () => {
      const todayIso = startOfDay(new Date()).toISOString();
      const [plans, audits, todaysExecs, templates] = await Promise.all([
        supabase
          .from("action_plans")
          .select("id, description, due_date, status, responsible, priority")
          .not("status", "in", "(concluido,cancelado)")
          .order("due_date", { ascending: true, nullsFirst: false })
          .limit(20),
        supabase
          .from("quality_audits")
          .select("id, iso_week, iso_year, started_at")
          .eq("status", "em_andamento")
          .order("started_at", { ascending: false }),
        supabase
          .from("checklist_executions")
          .select("id, template_id")
          .gte("started_at", todayIso),
        supabase
          .from("checklist_templates")
          .select("id, name, slug, kind, schedule_days, sector:sectors(name)")
          .eq("is_active", true)
          .eq("kind", "operacional"),
      ]);
      return {
        plans: plans.data ?? [],
        audits: audits.data ?? [],
        todaysExecs: todaysExecs.data ?? [],
        templates: templates.data ?? [],
      };
    },
  });

  const pending = useMemo(() => {
    if (!pendingQ.data) return null;
    const today = startOfDay(new Date());
    const overdue = pendingQ.data.plans.filter(
      (p) => p.due_date && new Date(p.due_date) < today,
    );
    const dueSoon = pendingQ.data.plans.filter((p) => {
      if (!p.due_date) return false;
      const d = differenceInCalendarDays(new Date(p.due_date), today);
      return d >= 0 && d <= 7;
    });
    const doneTemplateIds = new Set(pendingQ.data.todaysExecs.map((e) => e.template_id));
    const scheduledToday = pendingQ.data.templates.filter((t) =>
      isScheduledFor((t as { schedule_days?: number[] }).schedule_days, today),
    );
    const pendingChecklists = scheduledToday.filter((t) => !doneTemplateIds.has(t.id));
    return { overdue, dueSoon, openAudits: pendingQ.data.audits, pendingChecklists };
  }, [pendingQ.data]);

  const stats = useMemo(() => {
    if (!q.data) return null;
    const execs = q.data.executions;
    const total = execs.length;
    const done = execs.filter((e) => e.status === "concluido");
    const inProgress = execs.filter((e) => e.status === "em_andamento");
    const notStarted = Math.max(0, total - done.length - inProgress.length);

    const avg = done.length
      ? +(done.reduce((s, e) => s + (Number(e.score) || 0), 0) / done.length).toFixed(1)
      : 0;

    const criticalNcs = q.data.ncs.filter((n) => (n as any).item?.is_critical).length;
    const overduePlans = q.data.plans.filter(
      (p) => p.due_date && new Date(p.due_date) < new Date() && p.status !== "concluido" && p.status !== "cancelado"
    ).length;

    const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

    const sectorMap = new Map<string, { total: number; sum: number; done: number }>();
    execs.forEach((e) => {
      const sector = (e as any).template?.sector?.name ?? "Outro";
      const s = sectorMap.get(sector) ?? { total: 0, sum: 0, done: 0 };
      s.total++;
      if (e.status === "concluido") {
        s.done++;
        s.sum += Number(e.score) || 0;
      }
      sectorMap.set(sector, s);
    });
    const ranking = Array.from(sectorMap.entries())
      .map(([sector, v]) => ({ sector, score: v.done ? +(v.sum / v.done).toFixed(1) : 0, count: v.total }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);

    const days = eachDayOfInterval({ start: q.data.since, end: new Date() });
    const evolution = days.map((d) => {
      const key = format(d, "yyyy-MM-dd");
      const dayDone = done.filter((e) => e.finished_at && format(new Date(e.finished_at), "yyyy-MM-dd") === key);
      const score = dayDone.length
        ? +(dayDone.reduce((s, e) => s + (Number(e.score) || 0), 0) / dayDone.length).toFixed(1)
        : null;
      return { date: format(d, "dd/MM"), score, count: dayDone.length };
    });

    // Top NCs recorrentes por nome de item
    const ncCounts = new Map<string, { name: string; count: number; critical: boolean }>();
    q.data.ncs.forEach((n) => {
      const item = (n as any).item as { name?: string; is_critical?: boolean } | null;
      const name = item?.name?.trim();
      if (!name) return;
      const prev = ncCounts.get(name) ?? { name, count: 0, critical: !!item?.is_critical };
      prev.count++;
      if (item?.is_critical) prev.critical = true;
      ncCounts.set(name, prev);
    });
    const topNcs = Array.from(ncCounts.values()).sort((a, b) => b.count - a.count).slice(0, 5);

    // Distribuição de planos de ação por status
    const plansByStatus = { aberto: 0, em_andamento: 0, concluido: 0, atrasado: 0, cancelado: 0 } as Record<string, number>;
    const nowRef = new Date();
    q.data.plans.forEach((p) => {
      if (p.status === "concluido" || p.status === "cancelado") {
        plansByStatus[p.status]++;
        return;
      }
      const overdue = p.due_date && new Date(p.due_date) < nowRef;
      if (overdue) plansByStatus.atrasado++;
      else if (p.status === "em_andamento") plansByStatus.em_andamento++;
      else plansByStatus.aberto++;
    });

    return {
      total, done: done.length, inProgress: inProgress.length, notStarted,
      pctDone: pct(done.length), pctProgress: pct(inProgress.length), pctNotStarted: pct(notStarted),
      avg, criticalNcs, totalNcs: q.data.ncs.length, overduePlans,
      ranking, evolution, topNcs, plansByStatus,
    };
  }, [q.data]);

  if (q.isLoading || !stats) {
    return (
      <div className="p-16 text-center">
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
      </div>
    );
  }

  const donutData = [
    { name: "Concluídos", value: stats.done },
    { name: "Em andamento", value: stats.inProgress },
    { name: "Não iniciados", value: stats.notStarted },
  ];
  const donutFills = ["var(--success)", "var(--warning)", "color-mix(in oklab, var(--muted-foreground) 40%, transparent)"];

  return (
    <div className="space-y-8">
      {/* Header */}
      <header
        className="relative z-30 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 stagger-in"
        style={{ animationDelay: "0ms" }}
      >
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-2">
            <Sparkles className="w-3 h-3" />
            Painel executivo
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold leading-tight tracking-tight truncate">
            {greeting()},{" "}
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-primary)" }}>
              {name || "Diretor"}
            </span>
          </h1>
          <p className="text-sm text-muted-foreground capitalize mt-1">
            {format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
        <div className="relative flex items-center gap-2 shrink-0">
          <div className="hidden sm:inline-flex items-center gap-2 rounded-full border border-border bg-card/70 backdrop-blur px-3.5 py-2 text-xs font-medium text-muted-foreground">
            <CalendarDays className="w-3.5 h-3.5" />
            Últimos {periodDays} dias
          </div>
          <button
            type="button"
            onClick={() => setFilterOpen((v) => !v)}
            className="rounded-full border border-border bg-card/70 backdrop-blur p-2.5 hover:bg-card transition-colors"
            aria-label="Filtros"
            aria-expanded={filterOpen}
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
          {filterOpen && (
            <>
              <button
                type="button"
                aria-label="Fechar filtros"
                onClick={() => setFilterOpen(false)}
                className="fixed inset-0 z-40 cursor-default"
              />
              <div className="absolute right-0 top-full mt-2 z-50 w-48 rounded-xl border border-border bg-card shadow-lg p-2 animate-fade-in">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-2 py-1.5">
                  Período
                </div>
                {([7, 30, 90] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      setPeriodDays(d);
                      setFilterOpen(false);
                    }}
                    className={`w-full text-left px-2 py-2 rounded-lg text-sm hover:bg-muted transition-colors ${
                      periodDays === d ? "bg-muted font-semibold text-primary" : ""
                    }`}
                  >
                    Últimos {d} dias
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

      </header>

      {/* Hero card — total + avg (topo) */}
      <div
        className="card-premium p-6 sm:p-8 relative overflow-hidden stagger-in"
        style={{ animationDelay: "30ms" }}
      >
        <div
          className="absolute -top-24 -right-24 w-72 h-72 rounded-full opacity-60 blur-3xl pointer-events-none"
          style={{ background: "var(--gradient-primary)" }}
        />
        <div className="relative">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
            Checklists no período
          </div>
          <div className="mt-3 flex items-baseline gap-3">
            <div className="font-display text-6xl sm:text-7xl font-bold tabular-nums leading-none">
              {stats.total}
            </div>
            <div className="text-sm text-muted-foreground">execuções</div>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-4 max-w-md">
            <MiniStat label="Score médio" value={`${stats.avg}%`} tone="primary" />
            <MiniStat label="NCs críticas" value={stats.criticalNcs} tone="destructive" />
            <MiniStat label="Planos" value={stats.overduePlans} tone="warning" sub="vencidos" />
          </div>
        </div>
      </div>

      {/* Pendências — o que precisa de você agora */}
      {pending && (
        <PendingSection
          pending={pending}
          canRunChecklist={canRunChecklist}
          canRunQualityAudit={canRunQualityAudit}
          canViewActionPlans={canViewActionPlans}
        />
      )}

      {/* Bento grid */}
      <div className="grid grid-cols-12 gap-4 sm:gap-5">


        {/* Donut */}
        <div
          className="col-span-12 lg:col-span-5 card-premium p-6 stagger-in"
          style={{ animationDelay: "120ms" }}
        >
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-display text-lg font-bold">Taxa de conclusão</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Distribuição do status</p>
            </div>
            <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-success/10 text-success">
              +{stats.pctDone}%
            </span>
          </div>
          <div className="relative h-44 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  dataKey="value"
                  innerRadius={62}
                  outerRadius={82}
                  paddingAngle={3}
                  stroke="none"
                  startAngle={90}
                  endAngle={-270}
                >
                  {donutData.map((_, i) => (
                    <Cell key={i} fill={donutFills[i]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 grid place-items-center pointer-events-none">
              <div className="text-center">
                <div className="font-display text-3xl font-bold tabular-nums leading-none">{stats.pctDone}%</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">concluído</div>
              </div>
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            <LegendRow color={donutFills[0]} label="Finalizados" value={stats.done} pct={stats.pctDone} />
            <LegendRow color={donutFills[1]} label="Em andamento" value={stats.inProgress} pct={stats.pctProgress} />
            <LegendRow color={donutFills[2]} label="Não iniciados" value={stats.notStarted} pct={stats.pctNotStarted} />
          </div>
        </div>

        {/* Status tiles */}
        {[
          { tone: "muted" as const, label: "Não iniciado", value: stats.notStarted, pct: stats.pctNotStarted, icon: ClipboardList, delay: 180 },
          { tone: "warning" as const, label: "Em andamento", value: stats.inProgress, pct: stats.pctProgress, icon: PlayCircle, delay: 220 },
          { tone: "destructive" as const, label: "Planos vencidos", value: stats.overduePlans, icon: AlertTriangle, sub: `${stats.criticalNcs} NCs críticas`, delay: 260 },
          { tone: "success" as const, label: "Finalizados", value: stats.done, pct: stats.pctDone, icon: CheckCircle2, delay: 300 },
        ].map((s) => (
          <div
            key={s.label}
            className="col-span-6 lg:col-span-3 stagger-in"
            style={{ animationDelay: `${s.delay}ms` }}
          >
            <StatusCard {...s} />
          </div>
        ))}

        {/* Evolution area chart */}
        <div
          className="col-span-12 lg:col-span-7 card-premium p-6 stagger-in"
          style={{ animationDelay: "360ms" }}
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 grid place-items-center rounded-xl" style={{ background: "color-mix(in oklab, var(--primary) 12%, transparent)" }}>
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold">Evolução de desempenho</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Score médio diário</p>
              </div>
            </div>
          </div>
          <div className="h-56 -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.evolution} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} interval={4} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} width={30} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    fontSize: 12,
                    boxShadow: "var(--shadow-md)",
                  }}
                  formatter={(v: any) => [`${v}%`, "Score"]}
                />
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke="var(--primary)"
                  strokeWidth={2.5}
                  fill="url(#scoreFill)"
                  connectNulls
                  activeDot={{ r: 5, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Ranking */}
        <div
          className="col-span-12 lg:col-span-5 card-premium p-6 stagger-in"
          style={{ animationDelay: "420ms" }}
        >
          <div className="mb-4">
            <h2 className="font-display text-lg font-bold">Ranking por setores</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Conformidade média por setor</p>
          </div>
          <div className="space-y-4">
            {stats.ranking.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-6">Sem dados no período.</div>
            )}
            {stats.ranking.map((r, i) => (
              <div key={r.sector}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="text-sm font-semibold flex items-center gap-2 min-w-0">
                    <span className="w-5 h-5 grid place-items-center rounded-md bg-muted text-[10px] font-bold text-muted-foreground shrink-0">
                      {i + 1}
                    </span>
                    <span className="capitalize truncate">{r.sector}</span>
                  </div>
                  <div className={`text-sm font-bold tabular-nums ${scoreColor(r.score)}`}>{r.score}%</div>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.min(100, r.score)}%`,
                      background: r.score >= 70 ? "var(--success)" : r.score >= 50 ? "var(--warning)" : "var(--destructive)",
                    }}
                  />
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">{r.count} checklists</div>
              </div>
            ))}
          </div>
        </div>

        {/* Planos de ação — donut */}
        <div className="col-span-12 lg:col-span-5 card-premium p-6 stagger-in" style={{ animationDelay: "460ms" }}>
          <div className="mb-4">
            <h2 className="font-display text-lg font-bold">Planos de ação</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Distribuição por status</p>
          </div>
          {(() => {
            const items = [
              { key: "aberto", label: "Aberto", value: stats.plansByStatus.aberto, color: "color-mix(in oklab, var(--muted-foreground) 40%, transparent)" },
              { key: "em_andamento", label: "Em andamento", value: stats.plansByStatus.em_andamento, color: "var(--warning)" },
              { key: "concluido", label: "Concluído", value: stats.plansByStatus.concluido, color: "var(--success)" },
              { key: "atrasado", label: "Atrasado", value: stats.plansByStatus.atrasado, color: "var(--destructive)" },
            ];
            const total = items.reduce((s, i) => s + i.value, 0);
            if (total === 0) return <div className="text-sm text-muted-foreground text-center py-10">Nenhum plano de ação registrado.</div>;
            return (
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-4">
                <div className="relative h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={items} dataKey="value" innerRadius={50} outerRadius={70} paddingAngle={3} stroke="none">
                        {items.map((it) => <Cell key={it.key} fill={it.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 grid place-items-center pointer-events-none">
                    <div className="text-center">
                      <div className="font-display text-2xl font-bold tabular-nums leading-none">{total}</div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">planos</div>
                    </div>
                  </div>
                </div>
                <ul className="space-y-1.5">
                  {items.map((it) => (
                    <li key={it.key} className="flex items-center justify-between text-xs gap-2">
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: it.color }} />
                        <span className="truncate">{it.label}</span>
                      </span>
                      <span className="font-bold tabular-nums">{it.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })()}
        </div>

        {/* Top NCs recorrentes */}
        <div className="col-span-12 lg:col-span-7 card-premium p-6 stagger-in" style={{ animationDelay: "500ms" }}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="font-display text-lg font-bold">Não conformidades recorrentes</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Top 5 itens com mais NCs no período</p>
            </div>
          </div>
          {stats.topNcs.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-10">Nenhuma NC registrada no período.</div>
          ) : (
            <ul className="space-y-3">
              {stats.topNcs.map((nc, i) => {
                const max = stats.topNcs[0].count || 1;
                const pct = Math.round((nc.count / max) * 100);
                return (
                  <li key={nc.name}>
                    <div className="flex items-center justify-between mb-1.5 gap-2">
                      <div className="text-sm font-semibold flex items-center gap-2 min-w-0">
                        <span className="w-5 h-5 grid place-items-center rounded-md bg-muted text-[10px] font-bold text-muted-foreground shrink-0">{i + 1}</span>
                        <span className="truncate">{nc.name}</span>
                        {nc.critical && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-destructive/15 text-destructive shrink-0">CRÍTICO</span>}
                      </div>
                      <div className="text-sm font-bold tabular-nums text-destructive shrink-0">{nc.count}</div>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: "var(--destructive)" }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {canRunChecklist && (
      <div className="pt-2 flex justify-center">
        <Link
          to="/checklists"
          className="group inline-flex items-center gap-1.5 text-sm text-primary font-semibold transition-colors hover:text-primary/80"
        >
          Ver todos os checklists
          <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
      </div>
      )}
    </div>
  );
}

function scoreColor(s: number) {
  if (s >= 70) return "text-success";
  if (s >= 50) return "text-warning";
  return "text-destructive";
}

function MiniStat({ label, value, tone, sub }: { label: string; value: string | number; tone: "primary" | "destructive" | "warning"; sub?: string }) {
  const color =
    tone === "primary" ? "text-primary" : tone === "destructive" ? "text-destructive" : "text-warning";
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
      <div className={`mt-1 font-display text-2xl font-bold tabular-nums leading-none ${color}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function LegendRow({ color, label, value, pct }: { color: string; label: string; value: number; pct: number }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
        <span className="text-foreground truncate">
          {label} <span className="text-muted-foreground">({value})</span>
        </span>
      </div>
      <span className="font-semibold tabular-nums">{pct}%</span>
    </div>
  );
}

function StatusCard({
  tone, label, value, pct, sub, icon: Icon,
}: {
  tone: "muted" | "warning" | "success" | "destructive";
  label: string; value: number; pct?: number; sub?: string; icon: React.ComponentType<{ className?: string }>;
}) {
  const toneMap = {
    muted: { chipBg: "bg-secondary", chipText: "text-muted-foreground", bar: "var(--muted-foreground)", iconBg: "bg-muted", iconText: "text-muted-foreground" },
    warning: { chipBg: "bg-warning/15", chipText: "text-warning-foreground", bar: "var(--warning)", iconBg: "bg-warning/10", iconText: "text-warning-foreground" },
    success: { chipBg: "bg-success/15", chipText: "text-success", bar: "var(--success)", iconBg: "bg-success/10", iconText: "text-success" },
    destructive: { chipBg: "bg-destructive/15", chipText: "text-destructive", bar: "var(--destructive)", iconBg: "bg-destructive/10", iconText: "text-destructive" },
  } as const;
  const t = toneMap[tone];
  return (
    <div className="card-premium p-4 h-full">
      <div className="flex items-start justify-between gap-2">
        <div className={`w-9 h-9 grid place-items-center rounded-xl ${t.iconBg}`}>
          <Icon className={`w-4 h-4 ${t.iconText}`} />
        </div>
        {typeof pct === "number" && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${t.chipBg} ${t.chipText} tabular-nums`}>
            {pct}%
          </span>
        )}
      </div>
      <div className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground leading-tight">
        {label}
      </div>
      <div className="mt-1 font-display text-3xl font-bold tabular-nums leading-none">{value}</div>
      {typeof pct === "number" && (
        <div className="mt-3 h-1 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: t.bar }} />
        </div>
      )}
      {sub && <div className="mt-2 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

type PendingPlan = {
  id: string;
  description: string;
  due_date: string | null;
  status: string;
  responsible: string | null;
  priority: string | null;
};
type PendingAudit = { id: string; iso_week: number; iso_year: number; started_at: string };
type PendingTemplate = { id: string; name: string; slug: string; sector: { name: string } | null };

function PendingSection({
  pending,
  canRunChecklist,
  canRunQualityAudit,
  canViewActionPlans,
}: {
  pending: {
    overdue: PendingPlan[];
    dueSoon: PendingPlan[];
    openAudits: PendingAudit[];
    pendingChecklists: PendingTemplate[];
  };
  canRunChecklist: boolean;
  canRunQualityAudit: boolean;
  canViewActionPlans: boolean;
}) {
  const overdue = canViewActionPlans ? pending.overdue : [];
  const dueSoon = canViewActionPlans ? pending.dueSoon : [];
  const openAudits = canRunQualityAudit ? pending.openAudits : [];
  const pendingChecklists = canRunChecklist ? pending.pendingChecklists : [];
  const totalPend =
    overdue.length +
    dueSoon.length +
    openAudits.length +
    pendingChecklists.length;

  if (totalPend === 0) {
    return (
      <section className="card-premium p-6 flex items-center gap-3">
        <div className="w-10 h-10 grid place-items-center rounded-xl bg-success/15 text-success">
          <CheckCircle2 className="w-5 h-5" />
        </div>
        <div>
          <div className="font-display text-base font-bold">Tudo em dia por aqui</div>
          <div className="text-xs text-muted-foreground">Nenhuma pendência para hoje.</div>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-bold">Pendências para você</h2>
          <p className="text-xs text-muted-foreground">O que precisa da sua atenção agora</p>
        </div>
        <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-warning/15 text-warning tabular-nums">
          {totalPend} {totalPend === 1 ? "item" : "itens"}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {overdue.length > 0 && (
          <PendingList
            tone="destructive"
            icon={AlertTriangle}
            title="Planos vencidos"
            to="/action-plans"
            items={overdue.slice(0, 4).map((p) => ({
              id: p.id,
              primary: p.description,
              secondary: p.due_date
                ? `Vencido há ${Math.abs(
                    differenceInCalendarDays(new Date(p.due_date), startOfDay(new Date())),
                  )} dia(s)${p.responsible ? ` · ${p.responsible}` : ""}`
                : p.responsible ?? "",
            }))}
            total={overdue.length}
          />
        )}
        {dueSoon.length > 0 && (
          <PendingList
            tone="warning"
            icon={Clock}
            title="Vence em até 7 dias"
            to="/action-plans"
            items={dueSoon.slice(0, 4).map((p) => ({
              id: p.id,
              primary: p.description,
              secondary: p.due_date
                ? `${format(new Date(p.due_date), "dd/MM", { locale: ptBR })}${
                    p.responsible ? ` · ${p.responsible}` : ""
                  }`
                : p.responsible ?? "",
            }))}
            total={dueSoon.length}
          />
        )}
        {openAudits.length > 0 && (
          <PendingList
            tone="primary"
            icon={ShieldCheck}
            title="Auditorias em andamento"
            to="/quality"
            items={openAudits.slice(0, 4).map((a) => ({
              id: a.id,
              primary: `Semana ${a.iso_week}/${a.iso_year}`,
              secondary: `Iniciada em ${format(new Date(a.started_at), "dd/MM 'às' HH:mm", { locale: ptBR })}`,
              to: `/quality/audit/${a.id}`,
            }))}
            total={openAudits.length}
          />
        )}
        {pendingChecklists.length > 0 && (
          <PendingList
            tone="muted"
            icon={ClipboardList}
            title="Checklists ainda não feitos hoje"
            to="/checklists"
            items={pendingChecklists.slice(0, 4).map((t) => ({
              id: t.id,
              primary: t.name,
              secondary: t.sector?.name ?? "",
              to: `/checklist/${t.slug}`,
            }))}
            total={pendingChecklists.length}
          />
        )}
      </div>
    </section>
  );
}

function PendingList({
  tone,
  icon: Icon,
  title,
  to,
  items,
  total,
}: {
  tone: "destructive" | "warning" | "primary" | "muted";
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  to: string;
  items: { id: string; primary: string; secondary: string; to?: string }[];
  total: number;
}) {
  const toneMap = {
    destructive: "bg-destructive/10 text-destructive",
    warning: "bg-warning/15 text-warning-foreground",
    primary: "bg-primary/10 text-primary",
    muted: "bg-muted text-foreground",
  } as const;
  return (
    <div className="card-premium p-4 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-9 h-9 grid place-items-center rounded-xl shrink-0 ${toneMap[tone]}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-sm truncate">{title}</div>
            <div className="text-[11px] text-muted-foreground tabular-nums">{total} no total</div>
          </div>
        </div>
        <Link to={to} className="text-xs font-semibold text-primary hover:underline shrink-0">
          Ver todos
        </Link>
      </div>
      <ul className="space-y-1.5">
        {items.map((it) => {
          const content = (
            <>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{it.primary}</div>
                {it.secondary && (
                  <div className="text-[11px] text-muted-foreground truncate">{it.secondary}</div>
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </>
          );
          return (
            <li key={it.id}>
              {it.to ? (
                <a
                  href={it.to}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/60 transition-colors"
                >
                  {content}
                </a>
              ) : (
                <Link
                  to={to}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/60 transition-colors"
                >
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
