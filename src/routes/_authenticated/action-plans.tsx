import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Camera, CheckCircle2, ChevronRight, Clock, Loader2, Trash2, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

type ActionStatus = "aberto" | "em_andamento" | "aguardando_validacao" | "concluido" | "vencido" | "cancelado";

import { RequirePerfil } from "@/components/RequirePerfil";

export const Route = createFileRoute("/_authenticated/action-plans")({
  component: () => <RequirePerfil allow={["gestor", "auditor"]}><ActionPlansPage /></RequirePerfil>,
});

const STATUS_LABEL: Record<ActionStatus, string> = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  aguardando_validacao: "Aguardando validação",
  concluido: "Concluído",
  vencido: "Vencido",
  cancelado: "Cancelado",
};

function ActionPlansPage() {
  const [filter, setFilter] = useState<"todos" | "abertos" | "concluidos">("abertos");
  const [respFilter, setRespFilter] = useState<string>("todos");

  const ncQ = useQuery({
    queryKey: ["nc-answers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_answers")
        .select(`
          id, observation, justification, answered_at,
          item:checklist_items(id, title, is_critical, priority),
          execution:checklist_executions(id, started_at, template:checklist_templates(name, slug, sector:sectors(name))),
          action_plans(id, description, solution, responsible, due_date, status, priority, corrected_at, updated_at)
        `)
        .eq("status", "nao_conforme")
        .order("answered_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const responsibles = useMemo(() => {
    const set = new Set<string>();
    (ncQ.data ?? []).forEach((r) => {
      const name = r.action_plans?.[0]?.responsible?.trim();
      if (name) set.add(name);
    });
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [ncQ.data]);

  const filtered = useMemo(() => {
    const list = ncQ.data ?? [];
    return list.filter((row) => {
      const plan = row.action_plans?.[0];
      const isDone = plan?.status === "concluido" || plan?.status === "cancelado";
      if (filter === "abertos" && isDone) return false;
      if (filter === "concluidos" && !isDone) return false;
      if (respFilter !== "todos" && (plan?.responsible ?? "") !== respFilter) return false;
      return true;
    });
  }, [ncQ.data, filter, respFilter]);

  const [openAnswerId, setOpenAnswerId] = useState<string | null>(null);
  const openRow = ncQ.data?.find((r) => r.id === openAnswerId) ?? null;

  return (
    <div className="space-y-4 pb-8">
      <div>
        <h1 className="text-2xl font-bold">Planos de ação</h1>
        <p className="text-sm text-muted-foreground">Trate as não conformidades encontradas nos checklists.</p>
      </div>

      <div className="flex gap-2 overflow-x-auto">
        {(["abertos", "concluidos", "todos"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 h-9 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              filter === f ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-muted"
            }`}
          >
            {f === "abertos" ? "Em aberto" : f === "concluidos" ? "Concluídos" : "Todos"}
          </button>
        ))}
      </div>

      {responsibles.length > 0 && (
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground shrink-0">Responsável:</Label>
          <select
            value={respFilter}
            onChange={(e) => setRespFilter(e.target.value)}
            className="h-9 rounded-lg border border-border bg-background px-3 text-sm flex-1 min-w-0"
          >
            <option value="todos">Todos</option>
            {responsibles.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      )}


      {ncQ.isLoading ? (
        <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="card-elevated p-8 text-center text-sm text-muted-foreground">
          <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-success" />
          Nenhuma não conformidade {filter === "abertos" ? "aberta" : filter === "concluidos" ? "concluída" : "encontrada"}.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((row) => {
            const plan = row.action_plans?.[0];
            const status = (plan?.status ?? "aberto") as ActionStatus;
            const overdue = plan?.due_date && new Date(plan.due_date) < new Date() && status !== "concluido" && status !== "cancelado";
            return (
              <button
                key={row.id}
                onClick={() => setOpenAnswerId(row.id)}
                className="w-full text-left card-elevated p-4 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start gap-3">
                  <div className={`shrink-0 w-10 h-10 rounded-xl grid place-items-center ${
                    row.item?.is_critical ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning"
                  }`}>
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm truncate">{row.item?.title}</span>
                      {row.item?.is_critical && <span className="critical-badge"><AlertTriangle className="w-3 h-3" />Crítico</span>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {row.execution?.template?.name} · {format(new Date(row.answered_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                    </div>
                    {row.observation && <p className="text-xs mt-2 line-clamp-2 text-foreground/80">{row.observation}</p>}
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <StatusBadge status={status} />
                      {plan?.due_date && (
                        <span className={`inline-flex items-center gap-1 text-xs ${overdue ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                          <Clock className="w-3 h-3" /> Prazo {format(new Date(plan.due_date), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      )}
                      {plan?.responsible && <span className="text-xs text-muted-foreground">Resp.: {plan.responsible}</span>}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0 mt-2" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {openRow && (
        <ActionPlanDrawer
          answer={openRow}
          onClose={() => setOpenAnswerId(null)}
        />
      )}

      <div className="text-center text-xs text-muted-foreground pt-2">
        <Link to="/reports" className="hover:text-foreground underline">Ver relatórios</Link>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ActionStatus }) {
  const map: Record<ActionStatus, string> = {
    aberto: "bg-warning/20 text-warning-foreground",
    em_andamento: "bg-primary/15 text-primary",
    aguardando_validacao: "bg-accent text-accent-foreground",
    concluido: "bg-success/20 text-success-foreground",
    vencido: "bg-destructive/15 text-destructive",
    cancelado: "bg-muted text-muted-foreground",
  };
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${map[status]}`}>{STATUS_LABEL[status]}</span>;
}

function ActionPlanDrawer({ answer, onClose }: { answer: any; onClose: () => void }) {
  const qc = useQueryClient();
  const plan = answer.action_plans?.[0];
  const [description, setDescription] = useState(plan?.description ?? answer.observation ?? "");
  const [solution, setSolution] = useState(plan?.solution ?? "");
  const [responsible, setResponsible] = useState(plan?.responsible ?? "");
  const [dueDate, setDueDate] = useState(plan?.due_date ? plan.due_date.substring(0, 10) : "");
  const [status, setStatus] = useState<ActionStatus>((plan?.status as ActionStatus) ?? "aberto");
  const [saving, setSaving] = useState(false);

  const evidencesQ = useQuery({
    queryKey: ["plan-evidences", plan?.id],
    enabled: !!plan?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attachments")
        .select("id, storage_path, created_at")
        .eq("action_plan_id", plan!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const withUrls = await Promise.all((data ?? []).map(async (a) => {
        const { data: signed } = await supabase.storage.from("attachments").createSignedUrl(a.storage_path, 3600);
        return { ...a, url: signed?.signedUrl ?? "" };
      }));
      return withUrls;
    },
  });

  async function uploadEvidence(file: File) {
    if (!plan?.id) return toast.error("Salve o plano antes de anexar evidência.");
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const path = `evidences/${userData.user!.id}/${plan.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("attachments").upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("attachments").insert({
        action_plan_id: plan.id, storage_path: path, kind: "evidence", created_by: userData.user!.id,
      });
      if (insErr) throw insErr;
      toast.success("Evidência anexada");
      qc.invalidateQueries({ queryKey: ["plan-evidences", plan.id] });
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  }

  async function removeEvidence(id: string, path: string) {
    if (!confirm("Remover essa evidência?")) return;
    await supabase.storage.from("attachments").remove([path]);
    await supabase.from("attachments").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["plan-evidences", plan?.id] });
  }

  async function save() {
    if (!description.trim()) return toast.error("Descreva o problema.");
    if (status === "concluido" && (evidencesQ.data?.length ?? 0) === 0) {
      return toast.error("Anexe pelo menos uma foto de evidência para concluir.");
    }
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const payload = {
      answer_id: answer.id,
      description: description.trim(),
      solution: solution.trim() || null,
      responsible: responsible.trim() || null,
      due_date: dueDate || null,
      status,
      corrected_at: status === "concluido" ? new Date().toISOString() : null,
      created_by: userData.user?.id ?? null,
    };
    const res = plan
      ? await supabase.from("action_plans").update(payload).eq("id", plan.id)
      : await supabase.from("action_plans").insert(payload);
    setSaving(false);
    if (res.error) return toast.error(res.error.message);
    toast.success("Plano de ação salvo!");
    qc.invalidateQueries({ queryKey: ["nc-answers"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    onClose();
  }


  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-card w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground">{answer.execution?.template?.name}</div>
            <div className="font-semibold text-sm">{answer.item?.title}</div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 space-y-4">
          {answer.observation && (
            <div className="text-xs bg-muted/50 rounded-lg p-3">
              <div className="font-semibold text-muted-foreground mb-1">Observação registrada no checklist</div>
              <p>{answer.observation}</p>
            </div>
          )}
          <div className="space-y-1">
            <Label>Problema / não conformidade</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="space-y-1">
            <Label>Ação corretiva</Label>
            <Textarea value={solution} onChange={(e) => setSolution(e.target.value)} rows={2} placeholder="Descreva o que será feito para corrigir." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Responsável</Label>
              <Input value={responsible} onChange={(e) => setResponsible(e.target.value)} placeholder="Nome" />
            </div>
            <div className="space-y-1">
              <Label>Prazo</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Situação</Label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(STATUS_LABEL) as ActionStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`h-9 text-xs font-medium rounded-lg border ${
                    status === s ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"
                  }`}
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Evidências (fotos)</Label>
            {!plan?.id ? (
              <p className="text-xs text-muted-foreground">Salve o plano uma vez para poder anexar fotos.</p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {(evidencesQ.data ?? []).map((ev) => (
                    <div key={ev.id} className="relative group aspect-square rounded-lg overflow-hidden border border-border bg-muted">
                      {ev.url && <img src={ev.url} alt="Evidência" className="w-full h-full object-cover" />}
                      <button
                        type="button"
                        onClick={() => removeEvidence(ev.id, ev.storage_path)}
                        className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
                        aria-label="Remover"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <label className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-primary hover:bg-muted/30 grid place-items-center cursor-pointer text-muted-foreground">
                    <Camera className="w-5 h-5" />
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadEvidence(f); e.target.value = ""; }}
                    />
                  </label>
                </div>
                {status === "concluido" && (evidencesQ.data?.length ?? 0) === 0 && (
                  <p className="text-xs text-destructive">Anexe pelo menos uma foto para concluir.</p>
                )}
              </>
            )}
          </div>

          <Button onClick={save} disabled={saving} className="w-full h-11 brand-gradient font-semibold">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar plano de ação"}
          </Button>

        </div>
      </div>
    </div>
  );
}

// Re-export for placeholder pages that still import it.
export function Placeholder({ title, text }: { title: string; text: string }) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{title}</h1>
      <div className="card-elevated p-8 text-center text-sm text-muted-foreground">{text}</div>
    </div>
  );
}
