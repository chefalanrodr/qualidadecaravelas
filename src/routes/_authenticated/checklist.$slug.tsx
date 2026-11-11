import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Camera, Check, ChevronDown, ChevronRight, X, MinusCircle, Loader2, ArrowLeft, Target, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { enqueueAnswer, enqueueFinalizeExecution, flushQueue, getQueuedAnswersForExecution, isOffline } from "@/lib/offline-queue";
import { addLocalEvidencePhoto, listLocalEvidencePhotos, removeLocalEvidencePhoto, uploadLocalEvidencePhotos, type LocalEvidencePhoto } from "@/lib/local-evidence";
import { SignaturePad } from "@/components/SignaturePad";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { RequirePerfil } from "@/components/RequirePerfil";


type AnswerStatus = "conforme" | "nao_conforme" | "nao_aplicavel";

export const Route = createFileRoute("/_authenticated/checklist/$slug")({
  component: () => <RequirePerfil allow={["operador", "gestor", "auditor"]}><ExecutePage /></RequirePerfil>,
});

function ExecutePage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const templateQ = useQuery({
    queryKey: ["template", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_templates")
        .select("id, name, description, kind, sector:sectors(name), items:checklist_items(id, position, title, guidance, priority, is_critical, weight, requires_photo_on_conforme, is_required, allow_not_applicable, has_goal, goal_value, evidence_hints)")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Checklist não encontrado");
      const items = (data.items ?? []).slice().sort((a, b) => a.position - b.position);
      return { ...data, items };
    },
  });

  const [executionId, setExecutionId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Auto-create or resume execution for today
  useEffect(() => {
    if (!templateQ.data || executionId || creating) return;
    setCreating(true);
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setCreating(false);
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { data: existing } = await supabase
        .from("checklist_executions")
        .select("id")
        .eq("template_id", templateQ.data.id)
        .eq("auditor_id", userData.user.id)
        .eq("status", "em_andamento")
        .gte("started_at", today.toISOString())
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        setExecutionId(existing.id);
      } else {
        const { data: created, error } = await supabase
          .from("checklist_executions")
          .insert({ template_id: templateQ.data.id, auditor_id: userData.user.id, status: "em_andamento" })
          .select("id")
          .single();
        if (error) {
          console.error("[checklist] insert execution failed:", error);
          toast.error("Não foi possível iniciar o checklist: " + error.message);
        }
        else setExecutionId(created.id);
      }
      setCreating(false);
    })();
  }, [templateQ.data, executionId, creating]);

  const answersQ = useQuery({
    queryKey: ["answers", executionId],
    enabled: !!executionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_answers")
        .select("id, item_id, status, observation, justification")
        .eq("execution_id", executionId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const [localAnswers, setLocalAnswers] = useState<Record<string, { id: string; item_id: string; status: AnswerStatus | null; observation: string | null; justification: string | null }>>({});

  useEffect(() => {
    if (!executionId) return;
    const queued = getQueuedAnswersForExecution(executionId);
    setLocalAnswers(Object.fromEntries(queued.map((a) => [a.item_id, {
      id: a.id,
      item_id: a.item_id,
      status: a.status,
      observation: a.observation,
      justification: a.justification,
    }])));
  }, [executionId]);

  const answersByItem = useMemo(() => {
    const m: Record<string, { id: string; status: AnswerStatus | null; observation: string | null; justification: string | null }> = {};
    answersQ.data?.forEach((a) => { m[a.item_id] = { ...a, status: a.status as AnswerStatus | null }; });
    Object.values(localAnswers).forEach((a) => { m[a.item_id] = { id: a.id, status: a.status, observation: a.observation, justification: a.justification }; });
    return m;
  }, [answersQ.data, localAnswers]);

  const items = templateQ.data?.items ?? [];
  const answered = items.filter((it) => answersByItem[it.id]?.status).length;
  const total = items.length;
  const pct = total ? Math.round((answered / total) * 100) : 0;

  const [currentIdx, setCurrentIdx] = useState<number | null>(null);
  const [signOpen, setSignOpen] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);

  function openFinalize() {
    if (!executionId) return;
    const missing = items.filter((it) => !answersByItem[it.id]?.status);
    if (missing.length > 0) {
      toast.error(`Faltam ${missing.length} item(ns) para responder.`);
      return;
    }
    const criticalPending = items.filter((it) => {
      const a = answersByItem[it.id];
      return it.is_critical && a?.status === "nao_conforme" && !(a.observation && a.observation.trim());
    });
    if (criticalPending.length > 0) {
      toast.error("Itens críticos Não Conformes exigem observação/plano de ação.");
      return;
    }
    setSignOpen(true);
  }

  async function confirmFinalize() {
    if (!executionId) return;
    if (!signature) {
      toast.error("Assine para concluir o checklist.");
      return;
    }
    setSigning(true);

    const applicable = items.filter((it) => answersByItem[it.id]?.status !== "nao_aplicavel");
    const weightSum = applicable.reduce((s, it) => s + it.weight, 0);
    const conformeSum = applicable
      .filter((it) => answersByItem[it.id]?.status === "conforme")
      .reduce((s, it) => s + it.weight, 0);
    const score = weightSum ? +((conformeSum / weightSum) * 100).toFixed(2) : 0;

    const finished_at = new Date().toISOString();
    if (isOffline()) {
      enqueueFinalizeExecution({ execution_id: executionId, score, finished_at });
      toast.success(`Checklist salvo offline — será sincronizado (nota ${score}%)`);
    } else {
      const { error } = await supabase
        .from("checklist_executions")
        .update({ status: "concluido", finished_at, score, auditor_signature: signature } as never)
        .eq("id", executionId);
      if (error) {
        enqueueFinalizeExecution({ execution_id: executionId, score, finished_at });
        toast.success(`Sem servidor — finalização enfileirada (nota ${score}%)`);
      } else {
        toast.success(`Checklist finalizado! Nota: ${score}%`);
      }
    }
    setSigning(false);
    setSignOpen(false);
    qc.invalidateQueries();
    navigate({ to: "/home" });
  }

  if (templateQ.isLoading) {
    return <div className="p-8 text-center text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;
  }
  if (templateQ.error || !templateQ.data) {
    return <div className="card-elevated p-6 text-center">Checklist não encontrado.</div>;
  }

  const currentItem = currentIdx !== null ? items[currentIdx] : null;

  return (
    <div className="pb-32">
      {/* Progress + header */}
      <div className="card-elevated p-4 mb-4 sticky top-[68px] z-20">
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => navigate({ to: "/home" })} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
          <div className="text-xs font-semibold text-muted-foreground">
            {answered}/{total} · {pct}%
          </div>
        </div>
        <h1 className="font-bold leading-tight">{templateQ.data.name}</h1>
        <div className="text-xs text-muted-foreground mb-2">{templateQ.data.sector?.name}</div>
        <Progress value={pct} className="h-2" />
      </div>

      {/* Item list — inline expansion */}
      <div className="space-y-3">
        {items.map((it, idx) => {
          const a = answersByItem[it.id];
          const isOpen = currentIdx === idx;
          return (
            <div
              key={it.id}
              id={`item-${it.id}`}
              className={`card-elevated overflow-hidden transition-shadow ${isOpen ? "shadow-lg ring-1 ring-primary/30" : ""}`}
            >
              <button
                type="button"
                onClick={() => setCurrentIdx(isOpen ? null : idx)}
                className="w-full text-left p-4 flex items-start gap-3 hover:bg-muted/40 transition-colors"
              >
                <div className={`shrink-0 w-9 h-9 rounded-full grid place-items-center text-sm font-bold ${a?.status ? statusColor(a.status) : "bg-muted text-muted-foreground"}`}>
                  {a?.status ? statusIcon(a.status) : it.position}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{it.title}</span>
                    {it.is_critical && <span className="critical-badge"><AlertTriangle className="w-3 h-3" />Crítico</span>}
                  </div>
                  {it.guidance && !isOpen && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{it.guidance}</p>}
                </div>
                <ChevronDown className={`w-5 h-5 text-muted-foreground shrink-0 mt-2 transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>

              {isOpen && executionId && (
                <div className="border-t border-border animate-accordion-down">
                  <ItemEditor
                    item={it}
                    executionId={executionId}
                    existing={a}
                    onSaved={(saved) => {
                      setLocalAnswers((prev) => ({
                        ...prev,
                        [saved.item_id]: saved,
                      }));
                      qc.invalidateQueries({ queryKey: ["answers", executionId] });
                    }}
                    onAdvance={() => {
                      const next = idx + 1;
                      if (next < items.length) {
                        setCurrentIdx(next);
                        setTimeout(() => {
                          document.getElementById(`item-${items[next].id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                        }, 50);
                      } else {
                        setCurrentIdx(null);
                      }
                    }}
                    onClose={() => setCurrentIdx(null)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-3 z-30">
        <div className="mx-auto max-w-6xl px-1">
          <Button
            onClick={openFinalize}
            disabled={answered < total}
            className="w-full h-12 brand-gradient text-base font-semibold"
          >
            {answered < total ? `Continuar checklist (${answered}/${total})` : "Finalizar checklist"}
          </Button>
        </div>
      </div>

      <Dialog open={signOpen} onOpenChange={setSignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assinatura do responsável</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Assine abaixo para confirmar a finalização deste checklist.
          </p>
          <SignaturePad value={signature} onChange={setSignature} height={180} />
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setSignOpen(false)} disabled={signing}>
              Cancelar
            </Button>
            <Button onClick={confirmFinalize} disabled={!signature || signing} className="brand-gradient">
              {signing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar e finalizar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


function statusColor(s: AnswerStatus) {
  if (s === "conforme") return "bg-success text-success-foreground";
  if (s === "nao_conforme") return "bg-destructive text-destructive-foreground";
  return "bg-muted-foreground/30 text-foreground";
}
function statusIcon(s: AnswerStatus) {
  if (s === "conforme") return <Check className="w-4 h-4" />;
  if (s === "nao_conforme") return <X className="w-4 h-4" />;
  return <MinusCircle className="w-4 h-4" />;
}

function ItemEditor({
  item, executionId, existing, onSaved, onAdvance, onClose,
}: {
  item: { id: string; position: number; title: string; guidance: string | null; is_critical: boolean; priority: string; requires_photo_on_conforme: boolean; allow_not_applicable?: boolean; has_goal?: boolean; goal_value?: string | null; evidence_hints?: unknown };
  executionId: string;
  existing?: { id: string; status: AnswerStatus | null; observation: string | null; justification: string | null };
  onSaved: (saved: { id: string; item_id: string; status: AnswerStatus; observation: string | null; justification: string | null }) => void;
  onAdvance: () => void;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<AnswerStatus | null>(existing?.status ?? null);
  const [observation, setObservation] = useState(existing?.observation ?? "");
  const [justification, setJustification] = useState(existing?.justification ?? "");
  const [localPhotos, setLocalPhotos] = useState<LocalEvidencePhoto[]>([]);
  const [saving, setSaving] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const photoScope = `checklist:${executionId}:${item.id}`;

  useEffect(() => {
    let active = true;
    listLocalEvidencePhotos(photoScope).then((photos) => { if (active) setLocalPhotos(photos); });
    return () => { active = false; };
  }, [photoScope]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!status) throw new Error("Selecione uma resposta.");
      if (status === "nao_conforme" && !observation.trim()) throw new Error("Descreva a não conformidade.");

      const { data: userData } = await supabase.auth.getUser();
      const payload = {
        execution_id: executionId,
        item_id: item.id,
        status,
        observation: observation || null,
        justification: status === "nao_aplicavel" ? null : justification || null,
        answered_by: userData.user?.id ?? "",
        answered_at: new Date().toISOString(),
        local_photo_scope: photoScope,
      };
      const dbPayload = {
        execution_id: payload.execution_id,
        item_id: payload.item_id,
        status: payload.status,
        observation: payload.observation,
        justification: payload.justification,
        answered_by: payload.answered_by,
        answered_at: payload.answered_at,
      };
      const saved = {
        id: existing?.id ?? `local-${item.id}`,
        item_id: item.id,
        status,
        observation: payload.observation,
        justification: payload.justification,
      };

      const online = typeof navigator === "undefined" ? true : navigator.onLine;
      if (!online) {
        enqueueAnswer(payload);
        return { queued: true as const, saved };
      }

      const { data, error } = await supabase
        .from("checklist_answers")
        .upsert(dbPayload, { onConflict: "execution_id,item_id" })
        .select("id");
      if (error) {
        // falha de rede/servidor — enfileira para reenvio
        enqueueAnswer(payload);
        return { queued: true as const, saved };
      }
      const answerId = data?.[0]?.id as string | undefined;
      if (answerId && userData.user?.id) {
        const uploaded = await uploadLocalEvidencePhotos(photoScope, answerId, `checklists/${executionId}/${item.id}`, userData.user.id);
        if (uploaded.failed) toast.warning(`Resposta salva, mas a foto ficou pendente: ${uploaded.error}`);
        setLocalPhotos(await listLocalEvidencePhotos(photoScope));
      }
      // aproveita para drenar pendências
      flushQueue();
      return { queued: false as const, saved: { ...saved, id: answerId ?? saved.id } };
    },
    onSuccess: (res) => {
      onSaved(res.saved);
      toast.success(res.queued ? "Salvo offline — será sincronizado" : "Resposta salva");
      onAdvance();
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setSaving(false),
  });

  async function addPhoto(file: File) {
    setSaving(true);
    try {
      const photo = await addLocalEvidencePhoto(photoScope, file);
      setLocalPhotos((p) => [...p, photo]);
      toast.success("Foto anexada. Ela será enviada ao salvar.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setSaving(false); }
  }

  async function removeLocalPhoto(id: string) {
    await removeLocalEvidencePhoto(id);
    setLocalPhotos((p) => p.filter((photo) => photo.id !== id));
  }

  return (
    <div className="p-4 space-y-4 bg-muted/20">
      {item.guidance && (
        <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg whitespace-pre-wrap">{item.guidance}</div>
      )}

      {item.has_goal && item.goal_value && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
          <Target className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <div className="text-sm"><span className="font-semibold">Meta:</span> {item.goal_value}</div>
        </div>
      )}

      {Array.isArray(item.evidence_hints) && item.evidence_hints.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Evidências esperadas</div>
          <ul className="text-sm space-y-1">
            {(item.evidence_hints as string[]).map((ev, i) => (
              <li key={i} className="flex gap-2"><span className="text-muted-foreground">•</span><span>{ev}</span></li>
            ))}
          </ul>
        </div>
      )}

      <div className={`grid gap-2 ${item.allow_not_applicable ? "grid-cols-3" : "grid-cols-2"}`}>
        <StatusButton active={status === "conforme"} onClick={() => setStatus("conforme")} color="success" icon={<Check className="w-4 h-4" />} label="Feito" />
        <StatusButton active={status === "nao_conforme"} onClick={() => setStatus("nao_conforme")} color="destructive" icon={<X className="w-4 h-4" />} label="Não Feito" />
        {item.allow_not_applicable && (
          <StatusButton active={status === "nao_aplicavel"} onClick={() => setStatus("nao_aplicavel")} color="muted" icon={<MinusCircle className="w-4 h-4" />} label="Não se aplica" />
        )}
      </div>

      {status === "nao_conforme" && (
        <div className="space-y-2">
          <label className="text-sm font-semibold">O que aconteceu? *</label>
          <Textarea value={observation} onChange={(e) => setObservation(e.target.value)} rows={3} placeholder="Descreva o motivo pelo qual não foi feito…" />
          {item.is_critical && (
            <div className="text-xs text-critical flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Item crítico: fotografia recomendada.
            </div>
          )}
        </div>
      )}

      {status === "conforme" && (
        <div className="space-y-2">
          <label className="text-sm font-semibold">Observação (opcional)</label>
          <Textarea value={observation} onChange={(e) => setObservation(e.target.value)} rows={2} placeholder="Observação opcional…" />
        </div>
      )}

      {status && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold">Fotografias ({localPhotos.length})</div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => cameraRef.current?.click()} className="h-9">
                <Camera className="w-4 h-4 mr-1" /> Câmera
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => galleryRef.current?.click()} className="h-9">
                <ImagePlus className="w-4 h-4 mr-1" /> Galeria
              </Button>
            </div>
          </div>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) addPhoto(f); e.target.value = ""; }} />
          <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden"
            onChange={(e) => { Array.from(e.target.files ?? []).forEach((f) => addPhoto(f)); e.target.value = ""; }} />
          {localPhotos.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {localPhotos.map((photo) => (
                <div key={photo.id} className="relative aspect-square overflow-hidden rounded-lg border border-border">
                  <img src={photo.dataUrl} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => removeLocalPhoto(photo.id)} className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 pt-2">
        <Button variant="outline" onClick={onClose} className="h-11">Fechar</Button>
        <Button
          onClick={() => { setSaving(true); saveMut.mutate(); }}
          disabled={!status || saving}
          className="h-11 brand-gradient font-semibold"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (<>Salvar e avançar <ChevronRight className="w-4 h-4 ml-1" /></>)}
        </Button>
      </div>
    </div>
  );
}


function StatusButton({ active, onClick, color, icon, label }: {
  active: boolean; onClick: () => void; color: "success" | "destructive" | "muted"; icon: React.ReactNode; label: string;
}) {
  const styles = {
    success: active ? "bg-success text-success-foreground border-success" : "border-border hover:bg-success/10",
    destructive: active ? "bg-destructive text-destructive-foreground border-destructive" : "border-border hover:bg-destructive/10",
    muted: active ? "bg-muted-foreground/30 text-foreground border-muted-foreground/50" : "border-border hover:bg-muted",
  }[color];
  return (
    <button type="button" onClick={onClick} className={`rounded-xl border-2 py-3 px-2 flex flex-col items-center gap-1 text-xs font-semibold transition ${styles}`}>
      {icon}
      <span className="text-center leading-tight">{label}</span>
    </button>
  );
}
