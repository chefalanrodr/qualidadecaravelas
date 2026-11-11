import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, ArrowLeft, Camera, Check, ChevronRight, Frown, ImagePlus, Loader2, MinusCircle, RotateCcw, Smile, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { scoreSector, type AnswerStatus } from "@/lib/quality";
import { SignaturePad } from "@/components/SignaturePad";
import { enqueueFinalizeAudit, enqueueQualityAnswer, getQueuedQualityAnswersForAudit, isOffline } from "@/lib/offline-queue";
import { RequirePerfil } from "@/components/RequirePerfil";
import { addLocalEvidencePhoto, listLocalEvidencePhotos, removeLocalEvidencePhoto, uploadLocalEvidencePhotos, type LocalEvidencePhoto } from "@/lib/local-evidence";
import { saveQualityReportSnapshotForAudit } from "@/lib/quality-report-snapshot";

export const Route = createFileRoute("/_authenticated/quality/audit/$id")({
  component: () => <RequirePerfil allow={["gestor", "auditor"]}><AuditPage /></RequirePerfil>,
});

function AuditPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const auditQ = useQuery({
    queryKey: ["q-audit", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("quality_audits").select("*").eq("id", id).single();
      if (error) throw error; return data;
    },
  });

  const structQ = useQuery({
    queryKey: ["q-struct"],
    queryFn: async () => {
      const { data, error } = await supabase.from("quality_areas")
        .select("id, name, target_score, position, sectors:quality_sectors(id, name, position, is_active, items:quality_items!quality_items_sector_id_fkey(id, title, guidance, weight, is_critical, requires_photo, position, is_active, score_sector_id))")
        .eq("is_active", true).order("position");
      if (error) throw error;
      return (data ?? []).map((a) => ({
        ...a,
        sectors: (a.sectors ?? []).slice().sort((x, y) => x.position - y.position).map((s) => ({
          ...s, items: (s.items ?? []).filter((i) => i.is_active).slice().sort((x, y) => x.position - y.position),
        })),
      }));
    },
  });

  const answersQ = useQuery({
    queryKey: ["q-answers", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("quality_audit_answers")
        .select("id, sector_id, item_id, answer, observation, justification, photo_url").eq("audit_id", id);
      if (error) throw error; return data ?? [];
    },
  });

  const completedSectorsQ = useQuery({
    queryKey: ["q-audit-sectors", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quality_audit_sectors")
        .select("id, sector_id, score, total_items, conform, non_conform, na")
        .eq("audit_id", id);
      if (error) throw error; return data ?? [];
    },
  });

  const [localAnswers, setLocalAnswers] = useState<Record<string, { id: string; item_id: string; sector_id: string; answer: AnswerStatus; observation: string | null; justification: string | null }>>({});

  useEffect(() => {
    const queued = getQueuedQualityAnswersForAudit(id);
    setLocalAnswers(Object.fromEntries(queued.map((a) => [a.item_id, {
      id: a.id ?? `local-${a.item_id}`,
      item_id: a.item_id,
      sector_id: a.sector_id,
      answer: a.answer,
      observation: a.observation,
      justification: a.justification,
    }])));
  }, [id]);

  const answersByItem = useMemo(() => {
    const m: Record<string, { id: string; item_id: string; sector_id: string; answer: AnswerStatus; observation: string | null; justification: string | null }> = {};
    (answersQ.data ?? []).forEach((a) => { m[a.item_id] = { id: a.id, item_id: a.item_id, sector_id: a.sector_id, answer: a.answer as AnswerStatus, observation: a.observation, justification: a.justification }; });
    Object.values(localAnswers).forEach((a) => { m[a.item_id] = a; });
    return m;
  }, [answersQ.data, localAnswers]);

  const completedRowsBySector = useMemo(() => {
    const m = new Map<string, { id: string; sector_id: string; score: number; total_items: number; conform: number; non_conform: number; na: number }>();
    (completedSectorsQ.data ?? []).forEach((row) => m.set(row.sector_id, row));
    return m;
  }, [completedSectorsQ.data]);

  const [currentItemId, setCurrentItemId] = useState<string | null>(null);
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [auditorSig, setAuditorSig] = useState<string | null>(null);
  const [sectorDone, setSectorDone] = useState<null | {
    sectorId: string;
    sectorName: string;
    areaName: string;
    score: number;
    nextItemId: string | null;
    nextSectorName: string | null;
  }>(null);

  const allSectors = (structQ.data ?? []).flatMap((a) => a.sectors.map((s) => ({ ...s, _areaName: a.name, _areaTarget: Number(a.target_score) })));
  const completedSectorIds = [...completedRowsBySector.keys()];
  const auditableSectors = allSectors.filter((sector) => sector.is_active && sector.items.length > 0);
  const auditableSectorIds = new Set(auditableSectors.map((sector) => sector.id));
  const completedAuditedSectorIds = completedSectorIds.filter((sectorId) => auditableSectorIds.has(sectorId));
  const allItems = auditableSectors.flatMap((s) => s.items.map((i) => ({ ...i, _sectorId: s.id, _sectorName: s.name, _areaName: s._areaName })));
  const answeredCount = allItems.filter((i) => answersByItem[i.id]).length;
  const totalCount = allItems.length;
  const pct = totalCount ? Math.round((answeredCount / totalCount) * 100) : 0;

  function getAnswersMap(items: Array<{ id: string }>) {
    return Object.fromEntries(
      items
        .map((i) => [i.id, answersByItem[i.id] ? { answer: answersByItem[i.id].answer } : undefined])
        .filter(([, v]) => v),
    ) as Record<string, { answer: AnswerStatus }>;
  }

  function getScoredItemsForSector(sectorId: string) {
    return allItems.filter((item) => (item.score_sector_id ?? item._sectorId) === sectorId);
  }

  function getScoredItemsForSectorWithinAuditedSectors(sectorId: string, auditedSectorIds: string[]) {
    const included = new Set(auditedSectorIds);
    return allItems.filter((item) => included.has(item._sectorId) && (item.score_sector_id ?? item._sectorId) === sectorId);
  }

  function getSectorScore(sector: { id: string; items: Array<{ id: string; weight: number }> }) {
    const scoredItems = getScoredItemsForSector(sector.id);
    return scoreSector(scoredItems, getAnswersMap(scoredItems));
  }

  function buildSectorRow(sector: { id: string; items: Array<{ id: string; weight: number }> }, auditedSectorIds?: string[]) {
    const scoredItems = auditedSectorIds ? getScoredItemsForSectorWithinAuditedSectors(sector.id, auditedSectorIds) : getScoredItemsForSector(sector.id);
    const sc = scoreSector(scoredItems, getAnswersMap(scoredItems));
    return { audit_id: id, sector_id: sector.id, score: sc.score, total_items: sc.total, conform: sc.conform, non_conform: sc.nc, na: sc.na };
  }

  function buildSectorRowsForAuditedSectors(auditedSectorIds: string[]) {
    const included = new Set(auditedSectorIds);
    const scoringSectorIds = new Set(auditedSectorIds);
    allItems.forEach((item) => {
      if (!included.has(item._sectorId) || !answersByItem[item.id]) return;
      scoringSectorIds.add(item.score_sector_id ?? item._sectorId);
    });
    return [...scoringSectorIds]
      .map((sectorId) => {
        const sector = allSectors.find((s) => s.id === sectorId);
        return sector ? buildSectorRow(sector, auditedSectorIds) : null;
      })
      .filter((row): row is { audit_id: string; sector_id: string; score: number; total_items: number; conform: number; non_conform: number; na: number } => Boolean(row));
  }

  async function replaceAuditSectorRows(rows: ReturnType<typeof buildSectorRowsForAuditedSectors>) {
    const keepIds = rows.map((row) => row.sector_id);
    const deleteQuery = supabase.from("quality_audit_sectors").delete().eq("audit_id", id);
    const { error: deleteError } = keepIds.length
      ? await deleteQuery.not("sector_id", "in", `(${keepIds.join(",")})`)
      : await deleteQuery;
    if (deleteError) throw deleteError;
    if (!rows.length) return;
    const { error } = await supabase
      .from("quality_audit_sectors")
      .upsert(rows, { onConflict: "audit_id,sector_id" });
    if (error) throw error;
  }

  function calculateRestaurantScoreFromSectorIds(ids: string[]) {
    const included = new Set(ids);
    let possibleWeight = 0;
    let conformWeight = 0;
    allItems.forEach((item) => {
      if (!included.has(item._sectorId)) return;
      const answer = answersByItem[item.id]?.answer;
      if (!answer || answer === "nao_aplicavel") return;
      const weight = Number(item.weight);
      possibleWeight += weight;
      if (answer === "conforme") conformWeight += weight;
    });
    return possibleWeight ? +((conformWeight / possibleWeight) * 100).toFixed(2) : 0;
  }

  function shouldQueueWriteError(error: { message?: string } | null) {
    if (isOffline()) return true;
    const message = error?.message?.toLowerCase() ?? "";
    return message.includes("failed to fetch") || message.includes("network") || message.includes("load failed");
  }

  // Auto-resume: ao carregar uma auditoria em andamento, abre o primeiro item não respondido.
  const resumedRef = useRef(false);
  useEffect(() => {
    if (resumedRef.current) return;
    if (!structQ.data || !answersQ.data || !auditQ.data) return;
    if (auditQ.data.status !== "em_andamento") { resumedRef.current = true; return; }
    if (allItems.length === 0) return;
    const preferredSectorId = sessionStorage.getItem(`quality-start-sector:${id}`);
    if (preferredSectorId) sessionStorage.removeItem(`quality-start-sector:${id}`);
    const preferredSector = preferredSectorId ? allSectors.find((sector) => sector.id === preferredSectorId) : null;
    const preferredItem = preferredSector?.items.find((item) => !answersByItem[item.id]) ?? preferredSector?.items[0] ?? null;
    const firstUnanswered = preferredItem ?? allItems.find((i) => !answersByItem[i.id]);
    resumedRef.current = true;
    if (firstUnanswered) {
      setCurrentItemId(firstUnanswered.id);
      setTimeout(() => document.getElementById(`q-item-${firstUnanswered.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
    }
  }, [structQ.data, answersQ.data, auditQ.data, allItems, answersByItem]);

  // Compute scores from current answers, but only finished sectors compose the restaurant score.
  const areaScores = (structQ.data ?? []).map((a) => {
    const sectors = a.sectors.filter((s) => s.is_active && s.items.length > 0);
    const sectorScores = sectors.map((s) => {
      const score = getSectorScore(s);
      const completed = completedRowsBySector.has(s.id);
      const answered = s.items.filter((item) => answersByItem[item.id]).length;
      return { ...score, completed, answered, ready: s.items.length > 0 && answered === s.items.length };
    });
    const completedScores = sectorScores.filter((s) => s.completed);
    const conformWeight = completedScores.reduce((s, x) => s + x.conformWeight, 0);
    const possibleWeight = completedScores.reduce((s, x) => s + x.possibleWeight, 0);
    const avg = possibleWeight ? +((conformWeight / possibleWeight) * 100).toFixed(2) : 0;
    return { area: { ...a, sectors }, sectorScores, avg, conformWeight, possibleWeight, completedCount: completedScores.length };
  }).filter(({ area }) => area.sectors.length > 0);
  const restaurantScore = calculateRestaurantScoreFromSectorIds(completedAuditedSectorIds);
  const completedSectorCount = completedAuditedSectorIds.length;
  const pendingSectors = auditableSectors.filter((sector) => !completedRowsBySector.has(sector.id));
  const nextPendingSector = pendingSectors.find((sector) => sector.items.some((item) => !answersByItem[item.id])) ?? pendingSectors[0] ?? null;
  const nextPendingItem = nextPendingSector?.items.find((item) => !answersByItem[item.id]) ?? nextPendingSector?.items[0] ?? null;

  const finalizeSectorMut = useMutation({
    mutationFn: async (sectorId: string) => {
      if (isOffline()) throw new Error("Conecte-se para finalizar a area.");
      const sector = allSectors.find((s) => s.id === sectorId);
      if (!sector) throw new Error("Area nao encontrada.");
      if (sector.items.length === 0) throw new Error("Esta area nao possui perguntas.");
      const sc = getSectorScore(sector);
      const answered = sector.items.filter((item) => answersByItem[item.id]).length;
      if (answered < sector.items.length) throw new Error(`Faltam ${sector.items.length - answered} item(ns) nesta area.`);

      const nextIds = [...new Set([...completedAuditedSectorIds, sectorId])];
      await replaceAuditSectorRows(buildSectorRowsForAuditedSectors(nextIds));
      const nextScore = calculateRestaurantScoreFromSectorIds(nextIds);
      const { error: auditError } = await supabase
        .from("quality_audits")
        .update({ score: nextScore })
        .eq("id", id)
        .eq("status", "em_andamento");
      if (auditError) throw auditError;
      return { sectorName: sector.name, sectorScore: sc.score, restaurantScore: nextScore };
    },
    onSuccess: (res) => {
      toast.success(`Area ${res.sectorName} finalizada - nota ${res.sectorScore}%`);
      setCurrentItemId(null);
      qc.invalidateQueries({ queryKey: ["q-audit-sectors", id] });
      qc.invalidateQueries({ queryKey: ["q-audit", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reopenSectorMut = useMutation({
    mutationFn: async (sectorId: string) => {
      if (isOffline()) throw new Error("Conecte-se para reabrir a area.");
      const { error } = await supabase
        .from("quality_audit_sectors")
        .delete()
        .eq("audit_id", id)
        .eq("sector_id", sectorId);
      if (error) throw error;
      const nextIds = completedAuditedSectorIds.filter((sid) => sid !== sectorId);
      await replaceAuditSectorRows(buildSectorRowsForAuditedSectors(nextIds));
      const nextScore = calculateRestaurantScoreFromSectorIds(nextIds);
      const { error: auditError } = await supabase
        .from("quality_audits")
        .update({ score: nextScore })
        .eq("id", id)
        .eq("status", "em_andamento");
      if (auditError) throw auditError;
      return nextScore;
    },
    onSuccess: () => {
      toast.success("Area reaberta para edicao.");
      qc.invalidateQueries({ queryKey: ["q-audit-sectors", id] });
      qc.invalidateQueries({ queryKey: ["q-audit", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const finalizeMut = useMutation({
    mutationFn: async () => {
      if (completedAuditedSectorIds.length === 0) throw new Error("Finalize ao menos uma area para encerrar a auditoria.");
      const sectorIdSet = new Set(completedAuditedSectorIds);
      const sector_rows = buildSectorRowsForAuditedSectors(completedAuditedSectorIds);
      const finalScore = calculateRestaurantScoreFromSectorIds(completedAuditedSectorIds);
      const { data: userData } = await supabase.auth.getUser();
      const ncs = allItems.filter((i) => sectorIdSet.has(i._sectorId) && answersByItem[i.id]?.answer === "nao_conforme");
      const action_plans = ncs.map((it) => ({
        quality_audit_id: id,
        item_id: it.id,
        description: `NC em auditoria: ${it.title}`,
        status: "aberto" as const,
        created_by: userData.user?.id ?? null,
      }));
      const finished_at = new Date().toISOString();

      const enqueue = () => {
        enqueueFinalizeAudit({
          audit_id: id,
          finished_at,
          score: finalScore,
          auditor_signature: auditorSig,
          answers: [],
          sector_rows,
          action_plans,
        });
      };

      if (isOffline()) { enqueue(); return { queued: true as const, score: finalScore }; }

      if (sector_rows.length) {
        const { error } = await supabase.from("quality_audit_sectors").upsert(sector_rows, { onConflict: "audit_id,sector_id" });
        if (error) {
          if (shouldQueueWriteError(error)) { enqueue(); return { queued: true as const, score: finalScore, actionPlanError: null }; }
          throw new Error(`Nao consegui salvar a nota da area: ${error.message}`);
        }
      }
      const { error: uErr } = await supabase.from("quality_audits").update({
        status: "concluido", finished_at, score: finalScore, auditor_signature: auditorSig,
      }).eq("id", id);
      if (uErr) {
        if (shouldQueueWriteError(uErr)) { enqueue(); return { queued: true as const, score: finalScore, actionPlanError: null }; }
        throw new Error(`Nao consegui finalizar a auditoria: ${uErr.message}`);
      }

      let actionPlanError: string | null = null;
      if (action_plans.length) {
        const answersRes = await supabase.from("quality_audit_answers").select("id, item_id").eq("audit_id", id);
        const idByItem = Object.fromEntries((answersRes.data ?? []).map((r) => [r.item_id, r.id]));
        const plans = action_plans.map((p) => ({
          quality_audit_id: p.quality_audit_id,
          quality_answer_id: idByItem[p.item_id] ?? null,
          description: p.description,
          status: p.status,
          created_by: p.created_by,
        }));
        const { error: planError } = await supabase.from("action_plans").insert(plans);
        actionPlanError = planError?.message ?? null;
      }
      void saveQualityReportSnapshotForAudit(id).catch((error) => {
        console.warn("Nao consegui preparar o snapshot do relatorio", error);
      });
      return { queued: false as const, score: finalScore, actionPlanError };
    },
    onSuccess: (res) => {
      toast.success(res.queued
        ? `Auditoria salva offline — será sincronizada (nota ${res.score}%)`
        : `Auditoria finalizada · nota ${res.score}%`);
      if (res.actionPlanError) {
        toast.warning(`Auditoria finalizada, mas o plano de ação não foi criado: ${res.actionPlanError}`);
      }
      qc.invalidateQueries();
      navigate({ to: "/quality" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (structQ.isLoading || auditQ.isLoading || completedSectorsQ.isLoading) return <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground"/></div>;
  const loadError = structQ.error instanceof Error ? structQ.error : auditQ.error instanceof Error ? auditQ.error : completedSectorsQ.error instanceof Error ? completedSectorsQ.error : null;
  if (loadError) {
    return (
      <div className="p-6">
        <div className="card-elevated p-4 space-y-2">
          <button onClick={() => navigate({ to: "/quality" })} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"><ArrowLeft className="w-4 h-4"/> Voltar</button>
          <div className="font-semibold text-destructive">Nao consegui carregar a auditoria.</div>
          <div className="text-sm text-muted-foreground">{loadError.message}</div>
        </div>
      </div>
    );
  }
  const readOnly = auditQ.data?.status !== "em_andamento";
  const flatItems = allItems;
  const currentIdx = currentItemId ? flatItems.findIndex((i) => i.id === currentItemId) : -1;
  function scrollToItem(itemId: string) {
    setTimeout(() => {
      const el = document.getElementById(`q-item-${itemId}`);
      if (!el) return;
      const sticky = document.querySelector<HTMLElement>("[data-audit-sticky]");
      const offset = 68 + (sticky?.offsetHeight ?? 0) + 12;
      const top = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: "smooth" });
    }, 60);
  }
  function advance() {
    const next = currentIdx + 1;
    const cur = flatItems[currentIdx];
    const nxt = next < flatItems.length ? flatItems[next] : null;
    const curSector = cur ? allSectors.find((s) => s.id === cur._sectorId) : null;
    const curScore = curSector ? getSectorScore(curSector).score : 0;
    // Sector transition: pause and require user confirmation before jumping to the next sector.
    if (cur && nxt && cur._sectorId !== nxt._sectorId) {
      setCurrentItemId(null);
      setSectorDone({
        sectorId: cur._sectorId,
        sectorName: cur._sectorName,
        areaName: cur._areaName,
        score: curScore,
        nextItemId: nxt.id,
        nextSectorName: nxt._sectorName,
      });
      return;
    }
    if (cur && !nxt) {
      // Last item of the last sector — celebrate the sector too.
      setCurrentItemId(null);
      setSectorDone({
        sectorId: cur._sectorId,
        sectorName: cur._sectorName,
        areaName: cur._areaName,
        score: curScore,
        nextItemId: null,
        nextSectorName: null,
      });
      return;
    }
    if (nxt) {
      setCurrentItemId(nxt.id);
      scrollToItem(nxt.id);
    } else {
      setCurrentItemId(null);
    }
  }

  function openSector(sectorId: string) {
    const sector = allSectors.find((s) => s.id === sectorId);
    const item = sector?.items.find((i) => !answersByItem[i.id]) ?? sector?.items[0] ?? null;
    if (!item) {
      toast.info("Este setor nao possui perguntas ativas.");
      return;
    }
    setSectorDone(null);
    setCurrentItemId(item.id);
    scrollToItem(item.id);
  }


  return (
    <div className="pb-32 space-y-4">
      <div data-audit-sticky className="card-elevated p-4 sticky top-[68px] z-20">
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => navigate({ to: "/quality" })} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"><ArrowLeft className="w-4 h-4"/> Voltar</button>
          <div className="text-xs font-semibold text-muted-foreground">{answeredCount}/{totalCount} · {pct}% · {completedSectorCount} área(s) finalizada(s) · Nota restaurante {restaurantScore}%</div>
        </div>
        <h1 className="font-bold">Auditoria semanal — semana {auditQ.data?.iso_week}/{auditQ.data?.iso_year}</h1>
        <div className="text-xs text-muted-foreground mb-2">{auditQ.data?.week_of_month}ª semana do mês {auditQ.data?.month}/{auditQ.data?.year}</div>
        <Progress value={pct} className="h-2"/>
      </div>

      {!readOnly && allSectors.length > 0 && (
        <div className="card-elevated p-3 space-y-3 border border-primary/20">
          <div>
            <div className="font-semibold text-sm">Escolha o setor para auditar</div>
            <div className="text-xs text-muted-foreground">Voce pode iniciar por qualquer setor e voltar depois para os pendentes.</div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {allSectors.map((s) => {
              const completed = completedRowsBySector.has(s.id);
              const answered = s.items.filter((item) => answersByItem[item.id]).length;
              const active = currentItemId ? s.items.some((item) => item.id === currentItemId) : false;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => openSector(s.id)}
                  disabled={s.items.length === 0}
                  className={`text-left rounded-xl border p-3 transition-colors disabled:opacity-60 ${active ? "border-primary bg-primary/10" : "border-border hover:bg-muted"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-sm truncate">{s.name}</div>
                    {completed && <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/15 text-success font-bold">Finalizada</span>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{s._areaName} · {answered}/{s.items.length} item(ns)</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!readOnly && pendingSectors.length > 0 && (
        <div className="card-elevated p-3 flex flex-wrap items-center justify-between gap-3 border border-primary/20">
          <div className="text-sm">
            <div className="font-semibold">Ainda faltam {pendingSectors.length} área(s) para auditoria completa.</div>
            <div className="text-xs text-muted-foreground">
              Você pode iniciar por qualquer área. Próxima sugerida: <b>{nextPendingSector?.name ?? "—"}</b>.
            </div>
          </div>
          {nextPendingItem && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setCurrentItemId(nextPendingItem.id);
                scrollToItem(nextPendingItem.id);
              }}
              className="h-9"
            >
              Abrir próxima <ChevronRight className="w-4 h-4 ml-1"/>
            </Button>
          )}
        </div>
      )}

      {areaScores.map(({ area, sectorScores, avg, completedCount }) => (
        <section key={area.id} className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-lg">{area.name}</h2>
            <span className={`text-sm font-bold ${completedCount === 0 ? "text-muted-foreground" : avg >= Number(area.target_score) ? "text-success" : "text-destructive"}`}>
              {completedCount === 0 ? "Sem áreas finalizadas" : `${avg}%`}
              <span className="text-xs text-muted-foreground font-normal"> meta {Number(area.target_score)}%</span>
            </span>
          </div>
          <div className="space-y-3">
            {area.sectors.map((s, si) => {
              const sc = sectorScores[si];
              const sectorLocked = readOnly || sc.completed;
              const pending = Math.max(s.items.length - sc.answered, 0);
              return (
                <div key={s.id} className={`card-elevated p-3 ${sc.completed ? "border border-success/40" : ""}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="font-semibold text-sm flex items-center gap-2">
                      {s.name}
                      {sc.completed && <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/15 text-success font-bold">Finalizada</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">{sc.answered}/{s.items.length} · <span className={`font-bold ${sc.completed ? "text-success" : "text-foreground"}`}>{sc.score}%</span></div>
                  </div>
                  {!readOnly && s.items.length > 0 && (
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2">
                      <div className="text-xs text-muted-foreground">
                        {sc.completed ? "Nota desta área já entrou na nota do restaurante." : sc.ready ? "Área pronta para ser finalizada." : `Faltam ${pending} item(ns) para finalizar esta área.`}
                      </div>
                      {sc.completed ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={reopenSectorMut.isPending}
                          onClick={() => reopenSectorMut.mutate(s.id)}
                          className="h-8 gap-1"
                        >
                          {reopenSectorMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <RotateCcw className="w-3.5 h-3.5"/>}
                          Reabrir área
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          disabled={!sc.ready || finalizeSectorMut.isPending}
                          onClick={() => finalizeSectorMut.mutate(s.id)}
                          className="h-8 brand-gradient gap-1"
                        >
                          {finalizeSectorMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Check className="w-3.5 h-3.5"/>}
                          Finalizar área · {sc.score}%
                        </Button>
                      )}
                    </div>
                  )}
                  {s.items.length === 0 ? <div className="text-xs text-muted-foreground py-2">Área sem itens cadastrados.</div> : (
                    <div className="grid gap-1.5">
                      {s.items.map((it) => {
                        const a = answersByItem[it.id];
                        const open = currentItemId === it.id;
                        return (
                          <div key={it.id} id={`q-item-${it.id}`} className="rounded-lg border border-border overflow-hidden">
                            <button disabled={sectorLocked} onClick={() => setCurrentItemId(open ? null : it.id)}
                              className="w-full flex items-center gap-2 text-left px-2 py-2 hover:bg-muted disabled:opacity-70 disabled:hover:bg-transparent">
                              <span className={`w-6 h-6 rounded-full grid place-items-center text-xs font-bold shrink-0 ${a ? statusColor(a.answer) : "bg-muted text-muted-foreground"}`}>
                                {a ? statusIcon(a.answer) : it.position}
                              </span>
                              <span className="flex-1 text-sm">
                                <span className="block">{it.title}</span>
                                {it.guidance && <span className="block text-xs text-muted-foreground font-normal mt-0.5">{it.guidance}</span>}
                              </span>
                              {it.is_critical && <span className="critical-badge"><AlertTriangle className="w-3 h-3"/>Crítico</span>}
                              {!sectorLocked && <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}/>}
                            </button>
                            {open && !sectorLocked && (
                              <InlineAnswerEditor
                                auditId={id}
                                sectorId={s.id}
                                item={it}
                                existing={a}
                                onClose={() => setCurrentItemId(null)}
                                onSaved={(saved) => {
                                  setLocalAnswers((prev) => ({ ...prev, [saved.item_id]: saved }));
                                  qc.invalidateQueries({ queryKey: ["q-answers", id] });
                                }}
                                onAdvance={advance}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {!readOnly && (
        <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-3 z-30">
          <div className="mx-auto max-w-6xl px-1">
            <Button onClick={() => setFinalizeOpen(true)} disabled={finalizeMut.isPending || completedSectorCount === 0} className="w-full h-12 brand-gradient text-base font-semibold">
              {finalizeMut.isPending ? <Loader2 className="w-4 h-4 animate-spin"/> : completedSectorCount === 0 ? "Encerramento liberado apos finalizar um setor" : `Finalizar auditoria com ${completedSectorCount} area(s) - nota ${restaurantScore}%`}
            </Button>
          </div>
        </div>
      )}

      {sectorDone && (
        <div className="fixed inset-0 z-50" role="dialog">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSectorDone(null)}/>
          <div className="absolute inset-x-0 bottom-0 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[440px] bg-card rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-6 text-center space-y-3">
              <div className="mx-auto w-14 h-14 rounded-full bg-success/15 text-success grid place-items-center">
                <Check className="w-7 h-7"/>
              </div>
              <div>
                <div className="font-display font-bold text-xl">Área respondida</div>
                <div className="text-sm text-muted-foreground mt-1">
                  <b>{sectorDone.sectorName}</b> <span className="opacity-70">· {sectorDone.areaName}</span>
                </div>
                <div className="text-sm font-bold text-primary mt-1">Nota da área: {sectorDone.score}%</div>
              </div>
              {sectorDone.nextSectorName ? (
                <div className="text-sm bg-muted rounded-xl p-3">
                  Próxima área da fila: <b>{sectorDone.nextSectorName}</b>
                </div>
              ) : (
                <div className="text-sm bg-muted rounded-xl p-3">
                  Esta foi a última área da fila. Finalize a área para liberar o encerramento da auditoria.
                </div>
              )}
            </div>
            <div className="border-t border-border p-3 grid grid-cols-1 gap-2">
              <Button
                className="h-11 brand-gradient font-semibold"
                disabled={finalizeSectorMut.isPending}
                onClick={() => {
                  const sid = sectorDone.sectorId;
                  setSectorDone(null);
                  finalizeSectorMut.mutate(sid);
                }}
              >
                {finalizeSectorMut.isPending ? <Loader2 className="w-4 h-4 animate-spin"/> : <Check className="w-4 h-4 mr-1"/>}
                Finalizar esta área
              </Button>
              {sectorDone.nextSectorName && sectorDone.nextItemId ? (
                <Button
                  variant="outline"
                  className="h-11 font-semibold"
                  onClick={() => {
                    const nid = sectorDone.nextItemId!;
                    setSectorDone(null);
                    setCurrentItemId(nid);
                    scrollToItem(nid);
                  }}
                >
                  Abrir próxima área <ChevronRight className="w-4 h-4 ml-1"/>
                </Button>
              ) : null}
              <Button variant="outline" className="h-11" onClick={() => setSectorDone(null)}>Continuar depois</Button>
            </div>
          </div>
        </div>
      )}



      {finalizeOpen && (
        <div className="fixed inset-0 z-50" role="dialog">
          <div className="absolute inset-0 bg-black/50" onClick={() => !finalizeMut.isPending && setFinalizeOpen(false)}/>
          <div className="absolute inset-x-0 bottom-0 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[560px] bg-card rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <div className="font-bold">Finalizar auditoria</div>
                <div className="text-xs text-muted-foreground">{completedSectorCount} área(s) finalizada(s) · nota final: <b>{restaurantScore}%</b></div>
              </div>
              <button onClick={() => !finalizeMut.isPending && setFinalizeOpen(false)} className="rounded-lg p-2 hover:bg-muted"><X className="w-5 h-5"/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <SignaturePad label="Assinatura do auditor *" value={auditorSig} onChange={setAuditorSig} />
            </div>
            <div className="border-t border-border p-3">
              <Button
                onClick={() => {
                  if (!auditorSig) return toast.error("Assinatura do auditor é obrigatória.");
                  finalizeMut.mutate();
                }}
                disabled={finalizeMut.isPending}
                className="w-full h-11 brand-gradient font-semibold"
              >
                {finalizeMut.isPending ? <Loader2 className="w-4 h-4 animate-spin"/> : "Confirmar e finalizar"}
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function statusColor(s: AnswerStatus) {
  if (s === "conforme") return "bg-success text-success-foreground";
  if (s === "nao_conforme") return "bg-destructive text-destructive-foreground";
  return "bg-muted-foreground/30 text-foreground";
}
function statusIcon(s: AnswerStatus) {
  if (s === "conforme") return <Smile className="w-4 h-4"/>;
  if (s === "nao_conforme") return <Frown className="w-4 h-4"/>;
  return <MinusCircle className="w-3 h-3"/>;
}

function InlineAnswerEditor({ auditId, sectorId, item, existing, onClose, onSaved, onAdvance }: {
  auditId: string; sectorId: string;
  item: { id: string; title: string; guidance: string | null; is_critical: boolean; score_sector_id?: string | null };
  existing?: { id: string; item_id: string; sector_id: string; answer: AnswerStatus; observation: string | null; justification: string | null };
  onClose: () => void;
  onSaved: (saved: { id: string; item_id: string; sector_id: string; answer: AnswerStatus; observation: string | null; justification: string | null }) => void | Promise<void>;
  onAdvance: () => void;
}) {
  const [answer, setAnswer] = useState<AnswerStatus | null>(existing?.answer ?? null);
  const [observation, setObservation] = useState(existing?.observation ?? "");
  const [justification, setJustification] = useState(existing?.justification ?? "");
  const [saving, setSaving] = useState(false);
  const [localPhotos, setLocalPhotos] = useState<LocalEvidencePhoto[]>([]);
  const [attachments, setAttachments] = useState<{ id: string; path: string; url: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const photoScope = `quality:${auditId}:${item.id}`;
  const scoringSectorId = item.score_sector_id ?? sectorId;

  useEffect(() => {
    let active = true;
    listLocalEvidencePhotos(photoScope).then((photos) => { if (active) setLocalPhotos(photos); });
    return () => { active = false; };
  }, [photoScope]);

  useEffect(() => {
    if (!existing?.id) return;
    (async () => {
      const firstTry = await (supabase as any)
        .from("attachments")
        .select("id, storage_path, thumbnail_path")
        .eq("quality_answer_id", existing.id);
      const fallbackTry = firstTry.error?.message?.toLowerCase().includes("thumbnail_path")
        ? await supabase.from("attachments").select("id, storage_path").eq("quality_answer_id", existing.id)
        : null;
      const rows = (fallbackTry?.data ?? firstTry.data ?? []) as Array<{ id: string; storage_path: string; thumbnail_path?: string | null }>;
      const signed = await Promise.all(rows.map(async (r) => {
        const displayPath = r.thumbnail_path || r.storage_path;
        const { data: s } = await supabase.storage.from("attachments").createSignedUrl(displayPath, 3600);
        if (!s?.signedUrl && displayPath !== r.storage_path) {
          const original = await supabase.storage.from("attachments").createSignedUrl(r.storage_path, 3600);
          return { id: r.id, path: r.storage_path, url: original.data?.signedUrl ?? "" };
        }
        return { id: r.id, path: r.storage_path, url: s?.signedUrl ?? "" };
      }));
      setAttachments(signed);
    })();
  }, [existing?.id]);

  async function addFiles(files: FileList | null) {
    if (!files) return;
    const saved: LocalEvidencePhoto[] = [];
    for (const file of Array.from(files)) saved.push(await addLocalEvidencePhoto(photoScope, file));
    setLocalPhotos((p) => [...p, ...saved]);
  }

  async function removeLocalPhoto(id: string) {
    await removeLocalEvidencePhoto(id);
    setLocalPhotos((p) => p.filter((photo) => photo.id !== id));
  }

  async function removeAttachment(a: { id: string; path: string }) {
    await supabase.storage.from("attachments").remove([a.path]);
    await supabase.from("attachments").delete().eq("id", a.id);
    setAttachments((prev) => prev.filter((x) => x.id !== a.id));
  }

  async function save() {
    if (!answer) return toast.error("Selecione uma resposta.");
    if (answer === "nao_conforme" && !observation.trim()) return toast.error("Descreva a não conformidade.");
    setSaving(true);
    const payload = {
      audit_id: auditId,
      sector_id: scoringSectorId,
      item_id: item.id,
      answer,
      observation: observation || null,
      justification: answer === "nao_aplicavel" ? null : justification || null,
      local_photo_scope: photoScope,
    };
    const saved = {
      id: existing?.id ?? `local-${item.id}`,
      item_id: item.id,
      sector_id: scoringSectorId,
      answer,
      observation: payload.observation,
      justification: payload.justification,
    };

    if (isOffline()) {
      enqueueQualityAnswer(payload);
      await onSaved(saved);
      toast.success("Resposta salva offline — será sincronizada");
      setSaving(false);
      onAdvance();
      return;
    }

    const { data: up, error } = await supabase.from("quality_audit_answers").upsert({
      audit_id: payload.audit_id,
      sector_id: payload.sector_id,
      item_id: payload.item_id,
      answer: payload.answer,
      observation: payload.observation,
      justification: payload.justification,
    }, { onConflict: "audit_id,item_id" }).select("id");
    if (error || !up?.[0]) {
      enqueueQualityAnswer(payload);
      await onSaved(saved);
      toast.success("Resposta salva offline — será sincronizada");
      setSaving(false);
      onAdvance();
      return;
    }

    if (localPhotos.length) {
      setUploading(true);
      const { data: userData } = await supabase.auth.getUser();
      const uploaded = await uploadLocalEvidencePhotos(photoScope, up[0].id, `quality/${auditId}/${item.id}`, userData.user?.id, "quality");
      if (uploaded.failed) toast.warning(`Resposta salva, mas a foto ficou pendente: ${uploaded.error}`);
      setLocalPhotos(await listLocalEvidencePhotos(photoScope));
      setUploading(false);
    }

    try {
      await onSaved({ ...saved, id: up[0].id });
      toast.success("Resposta salva");
      onAdvance();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 space-y-4 bg-muted/20 border-t border-border">
      {item.guidance && <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg whitespace-pre-wrap">{item.guidance}</div>}
      <div className="grid grid-cols-3 gap-2">
        <StatusBtn active={answer === "conforme"} color="success" icon={<Smile className="w-6 h-6"/>} label="Positivo" onClick={() => setAnswer("conforme")}/>
        <StatusBtn active={answer === "nao_conforme"} color="destructive" icon={<Frown className="w-6 h-6"/>} label="Negativo" onClick={() => setAnswer("nao_conforme")}/>
        <StatusBtn active={answer === "nao_aplicavel"} color="muted" icon={<MinusCircle className="w-4 h-4"/>} label="Não Aplicável" onClick={() => setAnswer("nao_aplicavel")}/>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-semibold">
          {answer === "nao_conforme" ? "Observações / descrição da não conformidade *" : "Observações"}
        </label>
        <Textarea
          value={observation}
          onChange={(e) => setObservation(e.target.value)}
          rows={3}
          placeholder="Registre observações da pergunta..."
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold">Fotos ({attachments.length + localPhotos.length})</label>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => cameraRef.current?.click()} className="h-8">
              <Camera className="w-4 h-4 mr-1"/> Câmera
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => galleryRef.current?.click()} className="h-8">
              <ImagePlus className="w-4 h-4 mr-1"/> Galeria
            </Button>
          </div>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}/>
          <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}/>
        </div>
        {(attachments.length > 0 || localPhotos.length > 0) && (
          <div className="grid grid-cols-3 gap-2">
            {attachments.map((a) => (
              <div key={a.id} className="relative aspect-square rounded-lg overflow-hidden border border-border group">
                <img src={a.url} alt="" className="w-full h-full object-cover"/>
                <button type="button" onClick={() => removeAttachment(a)} className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-90"><Trash2 className="w-3 h-3"/></button>
              </div>
            ))}
            {localPhotos.map((photo) => (
              <div key={photo.id} className="relative aspect-square rounded-lg overflow-hidden border border-dashed border-primary">
                <img src={photo.dataUrl} alt="" className="w-full h-full object-cover"/>
                <button type="button" onClick={() => removeLocalPhoto(photo.id)} className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-90"><Trash2 className="w-3 h-3"/></button>
                <span className="absolute bottom-1 left-1 text-[10px] bg-primary text-primary-foreground rounded px-1">novo</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 pt-1">
        <Button variant="outline" onClick={onClose} className="h-11">Fechar</Button>
        <Button onClick={save} disabled={!answer || saving || uploading} className="h-11 brand-gradient font-semibold px-2 whitespace-nowrap">
          {saving || uploading ? <Loader2 className="w-4 h-4 animate-spin"/> : (
            <span className="inline-flex items-center justify-center gap-1 min-w-0">
              <span className="truncate">Salvar<span className="hidden sm:inline"> e avançar</span></span>
              <ChevronRight className="w-4 h-4 shrink-0"/>
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}

function StatusBtn({ active, onClick, color, icon, label }: { active: boolean; onClick: () => void; color: "success" | "destructive" | "muted"; icon: React.ReactNode; label: string }) {
  const styles = {
    success: active ? "bg-success text-success-foreground border-success shadow-sm" : "bg-success/10 text-success border-success/30 hover:bg-success/15",
    destructive: active ? "bg-destructive text-destructive-foreground border-destructive shadow-sm" : "bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/15",
    muted: active ? "bg-muted-foreground/30 text-foreground border-muted-foreground/50" : "border-border hover:bg-muted",
  }[color];
  return (
    <button type="button" onClick={onClick} className={`rounded-xl border-2 py-3 px-2 flex flex-col items-center gap-1 text-xs font-semibold transition ${styles}`}>
      {icon}<span>{label}</span>
    </button>
  );
}
