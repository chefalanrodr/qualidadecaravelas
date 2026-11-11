import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronRight, ClipboardList, Download, FileDown, FileText, Loader2, Printer, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";

import { RequirePerfil } from "@/components/RequirePerfil";
import { ReportsFilters, type FiltersValue } from "@/components/reports/ReportsFilters";
import { periodRange } from "@/lib/date-presets";
import { downloadCsv, exportRowsAsPdf, toCsv, type ExportColumn } from "@/lib/reports-export";

export const Route = createFileRoute("/_authenticated/reports/")({
  component: () => <RequirePerfil allow={["gestor", "auditor"]}><ReportsPage /></RequirePerfil>,
});

type Tab = "menu" | "checklist" | "quality";

function ReportsPage() {
  const [tab, setTab] = useState<Tab>("menu");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Relatórios</h1>
        <p className="text-sm text-muted-foreground">Filtre, exporte e imprima os relatórios das suas operações.</p>
      </div>

      {tab === "menu" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setTab("checklist")}
            className="card-elevated p-5 hover:shadow-lg transition-shadow flex items-center gap-4 text-left"
          >
            <div className="shrink-0 w-14 h-14 rounded-2xl bg-primary/15 text-primary grid place-items-center">
              <ClipboardList className="w-7 h-7" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-bold text-base">Relatórios de checklists</div>
              <div className="text-xs text-muted-foreground mt-0.5">Abertura, encerramento e demais checklists concluídos</div>
              <div className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                <Printer className="w-4 h-4" /> Ver, filtrar e exportar
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => setTab("quality")}
            className="card-elevated p-5 hover:shadow-lg transition-shadow flex items-center gap-4 text-left"
          >
            <div className="shrink-0 w-14 h-14 rounded-2xl brand-gradient grid place-items-center">
              <ShieldCheck className="w-7 h-7 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-bold text-base">Relatórios de qualidade</div>
              <div className="text-xs text-muted-foreground mt-0.5">Auditorias semanais e consolidado mensal</div>
              <div className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                <Printer className="w-4 h-4" /> Ver, filtrar e exportar
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
          </button>
        </div>
      )}

      {tab === "checklist" && <ChecklistReports onBack={() => setTab("menu")} />}
      {tab === "quality" && <QualityReports onBack={() => setTab("menu")} />}
    </div>
  );
}

function BackBar({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <div className="flex items-center justify-between">
      <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground">← Voltar</button>
      <h2 className="font-bold">{title}</h2>
      <span className="w-12" />
    </div>
  );
}

function scoreBadge(score: number) {
  if (score >= 90) return "bg-success/15 text-success";
  if (score >= 70) return "bg-warning/15 text-warning-foreground";
  return "bg-destructive/15 text-destructive";
}

type ChecklistRow = {
  id: string;
  score: number;
  started_at: string;
  finished_at: string | null;
  templateName: string;
  sectorName: string;
};

function ChecklistReports({ onBack }: { onBack: () => void }) {
  const [filters, setFilters] = useState<FiltersValue>({ period: "30d", search: "", sector: "" });

  const q = useQuery({
    queryKey: ["reports-list", filters.period],
    queryFn: async () => {
      const { from, to } = periodRange(filters.period);
      let query = supabase
        .from("checklist_executions")
        .select("id, status, score, started_at, finished_at, template:checklist_templates(name, sector:sectors(name))")
        .eq("status", "concluido")
        .order("started_at", { ascending: false })
        .limit(500);
      if (from) query = query.gte("started_at", from.toISOString());
      if (to) query = query.lte("started_at", to.toISOString());
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map<ChecklistRow>((e) => ({
        id: e.id,
        score: Number(e.score) || 0,
        started_at: e.started_at,
        finished_at: e.finished_at,
        templateName: e.template?.name ?? "—",
        sectorName: e.template?.sector?.name ?? "—",
      }));
    },
  });

  const sectors = useMemo(() => {
    const s = new Set<string>();
    (q.data ?? []).forEach((r) => r.sectorName && s.add(r.sectorName));
    return Array.from(s).sort();
  }, [q.data]);

  const filtered = useMemo(() => {
    const term = filters.search.trim().toLowerCase();
    return (q.data ?? []).filter((r) => {
      if (filters.sector && r.sectorName !== filters.sector) return false;
      if (term && !r.templateName.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [q.data, filters]);

  const columns: ExportColumn<ChecklistRow>[] = [
    { header: "Data", accessor: (r) => format(new Date(r.started_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) },
    { header: "Checklist", accessor: (r) => r.templateName },
    { header: "Setor", accessor: (r) => r.sectorName },
    { header: "Score (%)", accessor: (r) => r.score.toFixed(1) },
  ];

  function handleCsv() {
    downloadCsv(`checklists-${format(new Date(), "yyyyMMdd-HHmm")}.csv`, toCsv(filtered, columns));
  }
  async function handlePdf() {
    await exportRowsAsPdf({
      title: "Relatório de Checklists",
      subtitle: `${filtered.length} registro(s)`,
      filename: `checklists-${format(new Date(), "yyyyMMdd-HHmm")}.pdf`,
      rows: filtered,
      columns,
    });
  }

  return (
    <div className="space-y-3">
      <BackBar onBack={onBack} title="Checklists" />
      <ReportsFilters value={filters} onChange={setFilters} sectors={sectors} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          {filtered.length} de {q.data?.length ?? 0} registro(s)
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!filtered.length}
            onClick={handleCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button
            type="button"
            disabled={!filtered.length}
            onClick={handlePdf}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold hover:opacity-90 disabled:opacity-50"
          >
            <FileDown className="w-3.5 h-3.5" /> PDF
          </button>
        </div>
      </div>

      {q.isLoading ? (
        <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="card-elevated p-8 text-center text-sm text-muted-foreground">Nenhum checklist encontrado com esses filtros.</div>
      ) : (
        <div className="grid gap-2">
          {filtered.map((e) => (
            <Link
              key={e.id}
              to="/reports/$executionId"
              params={{ executionId: e.id }}
              className="card-elevated p-3 flex items-center gap-3 hover:shadow-lg transition-shadow"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate">{e.templateName}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {e.sectorName} · {format(new Date(e.started_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </div>
              </div>
              <div className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full tabular-nums ${scoreBadge(e.score)}`}>
                {e.score.toFixed(0)}%
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

type QualityRow = {
  id: string;
  score: number;
  iso_year: number;
  iso_week: number;
  week_of_month: number;
  started_at: string;
};

function QualityReports({ onBack }: { onBack: () => void }) {
  const [filters, setFilters] = useState<FiltersValue>({ period: "30d", search: "", sector: "" });

  const q = useQuery({
    queryKey: ["q-reports-list-simple", filters.period],
    queryFn: async () => {
      const { from, to } = periodRange(filters.period);
      let query = supabase
        .from("quality_audits")
        .select("id, iso_year, iso_week, week_of_month, month, year, score, started_at, finished_at, status")
        .eq("status", "concluido")
        .order("started_at", { ascending: false })
        .limit(500);
      if (from) query = query.gte("started_at", from.toISOString());
      if (to) query = query.lte("started_at", to.toISOString());
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map<QualityRow>((a) => ({
        id: a.id,
        score: Number(a.score) || 0,
        iso_year: a.iso_year,
        iso_week: a.iso_week,
        week_of_month: a.week_of_month ?? 0,
        started_at: a.started_at,
      }));
    },
  });

  const filtered = useMemo(() => {
    const term = filters.search.trim().toLowerCase();
    return (q.data ?? []).filter((r) => {
      if (!term) return true;
      return `semana ${r.iso_week}/${r.iso_year}`.includes(term);
    });
  }, [q.data, filters.search]);

  const columns: ExportColumn<QualityRow>[] = [
    { header: "Data", accessor: (r) => format(new Date(r.started_at), "dd/MM/yyyy", { locale: ptBR }) },
    { header: "Semana ISO", accessor: (r) => `${r.iso_week}/${r.iso_year}` },
    { header: "Semana do mês", accessor: (r) => `${r.week_of_month}ª` },
    { header: "Score (%)", accessor: (r) => r.score.toFixed(1) },
  ];

  function handleCsv() {
    downloadCsv(`auditorias-${format(new Date(), "yyyyMMdd-HHmm")}.csv`, toCsv(filtered, columns));
  }
  async function handlePdf() {
    await exportRowsAsPdf({
      title: "Relatório de Auditorias de Qualidade",
      subtitle: `${filtered.length} auditoria(s)`,
      filename: `auditorias-${format(new Date(), "yyyyMMdd-HHmm")}.pdf`,
      rows: filtered,
      columns,
    });
  }

  return (
    <div className="space-y-3">
      <BackBar onBack={onBack} title="Qualidade" />
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Auditorias concluídas — para o consolidado mensal completo, veja abaixo.</p>
        <Link to="/quality/reports" className="text-xs font-semibold text-primary hover:underline shrink-0">Consolidado mensal →</Link>
      </div>
      <ReportsFilters value={filters} onChange={setFilters} sectors={[]} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          {filtered.length} de {q.data?.length ?? 0} auditoria(s)
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!filtered.length}
            onClick={handleCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button
            type="button"
            disabled={!filtered.length}
            onClick={handlePdf}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold hover:opacity-90 disabled:opacity-50"
          >
            <FileDown className="w-3.5 h-3.5" /> PDF
          </button>
        </div>
      </div>

      {q.isLoading ? (
        <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="card-elevated p-8 text-center text-sm text-muted-foreground">Nenhuma auditoria encontrada com esses filtros.</div>
      ) : (
        <div className="grid gap-2">
          {filtered.map((a) => (
            <Link
              key={a.id}
              to="/quality/reports/$id"
              params={{ id: a.id }}
              className="card-elevated p-3 flex items-center gap-3 hover:shadow-lg transition-shadow"
            >
              <div className="w-10 h-10 rounded-xl brand-gradient grid place-items-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate">Semana {a.iso_week}/{a.iso_year} — {a.week_of_month}ª do mês</div>
                <div className="text-xs text-muted-foreground">
                  {format(new Date(a.started_at), "dd/MM/yyyy", { locale: ptBR })}
                </div>
              </div>
              <div className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full tabular-nums ${scoreBadge(a.score)}`}>
                {a.score.toFixed(0)}%
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
