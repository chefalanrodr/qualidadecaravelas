import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, Printer, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RequirePerfil } from "@/components/RequirePerfil";

export const Route = createFileRoute("/_authenticated/reports/$executionId")({
  component: () => <RequirePerfil allow={["gestor", "auditor"]}><ReportDetailPage /></RequirePerfil>,
});

function ReportDetailPage() {
  const { executionId } = Route.useParams();

  const q = useQuery({
    queryKey: ["report", executionId],
    queryFn: async () => {
      const { data: exec, error } = await supabase
        .from("checklist_executions")
        .select(`
          id, score, status, started_at, finished_at,
          template:checklist_templates(name, description, sector:sectors(name))
        `)
        .eq("id", executionId)
        .single();
      if (error) throw error;

      const answersSelect = `
          id, status, observation, justification, answered_at,
          item:checklist_items(id, title, is_critical, weight, position),
          attachments(id, storage_path, thumbnail_path),
          action_plans(id, description, solution, responsible, due_date, status)
        `;
      const firstTry = await (supabase as any)
        .from("checklist_answers")
        .select(answersSelect)
        .eq("execution_id", executionId);
      const fallbackTry = firstTry.error?.message?.toLowerCase().includes("thumbnail_path")
        ? await supabase
          .from("checklist_answers")
          .select(`
            id, status, observation, justification, answered_at,
            item:checklist_items(id, title, is_critical, weight, position),
            attachments(id, storage_path),
            action_plans(id, description, solution, responsible, due_date, status)
          `)
          .eq("execution_id", executionId)
        : null;
      const data = fallbackTry?.data ?? firstTry.data;
      const aErr = fallbackTry?.error ?? firstTry.error;
      if (aErr) throw aErr;

      const sorted = (data ?? []).sort(
        (a: any, b: any) => (a.item?.position ?? 0) - (b.item?.position ?? 0),
      );
      const answers = await Promise.all(sorted.map(async (answer: any) => {
        const attachments = await Promise.all((answer.attachments ?? []).map(async (attachment: any) => {
          const displayPath = attachment.thumbnail_path || attachment.storage_path;
          const { data: signed } = await supabase.storage.from("attachments").createSignedUrl(displayPath, 3600);
          if (!signed?.signedUrl && displayPath !== attachment.storage_path) {
            const original = await supabase.storage.from("attachments").createSignedUrl(attachment.storage_path, 3600);
            return { ...attachment, url: original.data?.signedUrl ?? null };
          }
          return { ...attachment, url: signed?.signedUrl ?? null };
        }));
        return { ...answer, attachments };
      }));

      return { exec, answers };
    },
  });

  if (q.isLoading) {
    return <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>;
  }
  if (q.error || !q.data) {
    return <div className="p-8 text-center text-sm text-destructive">Erro ao carregar relatório: {(q.error as Error)?.message ?? "não encontrado"}</div>;
  }

  const { exec, answers } = q.data;
  const conformes = answers.filter((a) => a.status === "conforme").length;
  const ncs = answers.filter((a) => a.status === "nao_conforme");
  const criticasNC = ncs.filter((a) => a.item?.is_critical).length;
  const nas = answers.filter((a) => a.status === "nao_aplicavel").length;

  return (
    <div className="space-y-4 pb-28 print:pb-0">
      <div className="flex items-center justify-between gap-2 print:hidden">
        <Link to="/reports" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Pré-visualização</span>
      </div>


      <div className="card-elevated p-6 print:shadow-none print:border-0 print:p-0">
        <div className="border-b border-border pb-4 mb-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Relatório de Checklist</div>
          <h1 className="text-2xl font-bold mt-1">{exec.template?.name}</h1>
          {exec.template?.sector?.name && (
            <div className="text-sm text-muted-foreground">Setor: {exec.template.sector.name}</div>
          )}
          <div className="text-sm text-muted-foreground mt-1">
            Iniciado: {format(new Date(exec.started_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            {exec.finished_at && <> · Finalizado: {format(new Date(exec.finished_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</>}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <SummaryBox label="Nota final" value={`${Number(exec.score) || 0}%`} tone="primary" />
          <SummaryBox label="Conformes" value={String(conformes)} tone="success" />
          <SummaryBox label="Não conformes" value={String(ncs.length)} sub={criticasNC ? `${criticasNC} críticas` : undefined} tone={criticasNC ? "destructive" : "warning"} />
          <SummaryBox label="Não aplicáveis" value={String(nas)} tone="muted" />
        </div>

        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Itens verificados</h2>
        <div className="space-y-2">
          {answers.map((a) => (
            <div key={a.id} className="border border-border rounded-lg p-3 break-inside-avoid">
              <div className="flex items-start gap-3">
                <StatusIcon status={a.status ?? ""} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{a.item?.title}</span>
                    {a.item?.is_critical && (
                      <span className="critical-badge"><AlertTriangle className="w-3 h-3" />Crítico</span>
                    )}
                  </div>
                  {a.observation && <p className="text-xs mt-1 text-foreground/80"><b>Observação:</b> {a.observation}</p>}
                  {a.justification && <p className="text-xs mt-1 text-foreground/80"><b>Justificativa:</b> {a.justification}</p>}
                  {a.action_plans?.[0] && (
                    <div className="text-xs mt-2 bg-muted/60 rounded p-2">
                      <div className="font-semibold">Plano de ação · {a.action_plans[0].status}</div>
                      {a.action_plans[0].solution && <div>Ação: {a.action_plans[0].solution}</div>}
                      {a.action_plans[0].responsible && <div>Responsável: {a.action_plans[0].responsible}</div>}
                      {a.action_plans[0].due_date && <div>Prazo: {format(new Date(a.action_plans[0].due_date), "dd/MM/yyyy", { locale: ptBR })}</div>}
                    </div>
                  )}
                  {a.attachments && a.attachments.length > 0 && (
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {a.attachments.map((attachment: any, index: number) => attachment.url ? (
                        <img
                          key={attachment.id ?? `${a.id}-${index}`}
                          src={attachment.url}
                          alt={`Evidencia ${index + 1}`}
                          loading="lazy"
                          className="h-24 w-full rounded-md border border-border object-cover"
                        />
                      ) : (
                        <div key={attachment.id ?? `${a.id}-${index}`} className="h-24 rounded-md border border-dashed border-border grid place-items-center text-[10px] text-muted-foreground">
                          Foto indisponivel
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-border text-xs text-muted-foreground">
          Documento gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}.
        </div>
      </div>

      <div className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur px-4 py-3 print:hidden">
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          <div className="text-xs text-muted-foreground flex-1 min-w-0 truncate">Revisou o relatório? Exporte quando quiser.</div>
          <Button onClick={() => window.print()} className="brand-gradient shrink-0">
            <Printer className="w-4 h-4 mr-2" /> Exportar PDF
          </Button>
        </div>
      </div>
    </div>

  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "conforme") return <CheckCircle2 className="w-5 h-5 text-success shrink-0" />;
  if (status === "nao_conforme") return <XCircle className="w-5 h-5 text-destructive shrink-0" />;
  return <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/40 shrink-0" />;
}

function SummaryBox({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: "primary" | "success" | "warning" | "destructive" | "muted" }) {
  const map = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/15 text-success",
    warning: "bg-warning/15 text-warning",
    destructive: "bg-destructive/15 text-destructive",
    muted: "bg-muted text-muted-foreground",
  };
  return (
    <div className={`rounded-xl p-3 ${map[tone]}`}>
      <div className="text-2xl font-bold leading-none">{value}</div>
      <div className="text-xs mt-1 opacity-80">{label}</div>
      {sub && <div className="text-[10px] uppercase tracking-wider mt-0.5 opacity-70">{sub}</div>}
    </div>
  );
}
