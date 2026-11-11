// Fila offline (outbox) para operações que exigem servidor.
// Persiste em localStorage; drena quando a rede volta.
import { supabase } from "@/integrations/supabase/client";
import { uploadLocalEvidencePhotos } from "@/lib/local-evidence";
import { saveQualityReportSnapshotForAudit } from "@/lib/quality-report-snapshot";

const ANSWERS_KEY = "checklist_outbox_v1";
const QUALITY_ANSWERS_KEY = "quality_answers_outbox_v1";
const OPS_KEY = "sync_ops_v1";
const ERROR_KEY = "sync_last_error_v1";

export type QueuedAnswer = {
  id: string;
  queued_at: number;
  execution_id: string;
  item_id: string;
  status: "conforme" | "nao_conforme" | "nao_aplicavel";
  observation: string | null;
  justification: string | null;
  answered_by: string;
  answered_at: string;
  local_photo_scope?: string | null;
};

export type QueuedAuditAnswer = {
  id?: string;
  queued_at?: number;
  audit_id: string;
  sector_id: string;
  item_id: string;
  answer: "conforme" | "nao_conforme" | "nao_aplicavel";
  observation: string | null;
  justification: string | null;
  local_photo_scope?: string | null;
};

export type FinalizeExecutionOp = {
  kind: "finalize_execution";
  id: string;
  queued_at: number;
  execution_id: string;
  score: number;
  finished_at: string;
};

export type FinalizeAuditOp = {
  kind: "finalize_audit";
  id: string;
  queued_at: number;
  audit_id: string;
  finished_at: string;
  score: number;
  auditor_signature: string | null;
  answers: QueuedAuditAnswer[];
  sector_rows: Array<{
    audit_id: string; sector_id: string; score: number;
    total_items: number; conform: number; non_conform: number; na: number;
  }>;
  action_plans: Array<{
    quality_audit_id: string;
    item_id: string;
    description: string;
    status: "aberto";
    created_by: string | null;
  }>;
};

export type Op = FinalizeExecutionOp | FinalizeAuditOp;

type Listener = (count: number) => void;
const listeners = new Set<Listener>();

export type SyncLastError = {
  message: string;
  at: number;
  retryable?: boolean;
};

export type QueueEntrySummary = {
  id: string;
  type: "checklist_answer" | "quality_answer" | "finalize_execution" | "finalize_audit";
  title: string;
  detail: string;
  queuedAt: number;
};

function readAnswers(): QueuedAnswer[] {
  if (typeof localStorage === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(ANSWERS_KEY) || "[]"); } catch { return []; }
}
function writeAnswers(list: QueuedAnswer[]) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(ANSWERS_KEY, JSON.stringify(list));
  notify();
}
function readQualityAnswers(): QueuedAuditAnswer[] {
  if (typeof localStorage === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(QUALITY_ANSWERS_KEY) || "[]"); } catch { return []; }
}
function writeQualityAnswers(list: QueuedAuditAnswer[]) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(QUALITY_ANSWERS_KEY, JSON.stringify(list));
  notify();
}
function readOps(): Op[] {
  if (typeof localStorage === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(OPS_KEY) || "[]"); } catch { return []; }
}
function writeOps(list: Op[]) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(OPS_KEY, JSON.stringify(list));
  notify();
}

function readLastError(): SyncLastError | null {
  if (typeof localStorage === "undefined") return null;
  try { return JSON.parse(localStorage.getItem(ERROR_KEY) || "null"); } catch { return null; }
}

function writeLastError(message: string, retryable = false) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(ERROR_KEY, JSON.stringify({ message, at: Date.now(), retryable }));
  notify();
}

function clearLastError() {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(ERROR_KEY);
  notify();
}

function errorFields(error: unknown): { message?: string; code?: string; details?: string; hint?: string; name?: string } {
  if (!error) return {};
  if (typeof error === "string") return { message: error };
  if (error instanceof Error) {
    const err = error as Error & { code?: string; details?: string; hint?: string };
    return { message: err.message, code: err.code, details: err.details, hint: err.hint, name: err.name };
  }
  if (typeof error === "object") {
    const err = error as Record<string, unknown>;
    return {
      message: typeof err.message === "string" ? err.message : undefined,
      code: typeof err.code === "string" ? err.code : undefined,
      details: typeof err.details === "string" ? err.details : undefined,
      hint: typeof err.hint === "string" ? err.hint : undefined,
      name: typeof err.name === "string" ? err.name : undefined,
    };
  }
  return { message: String(error) };
}

function isRetryableSyncError(error: unknown) {
  const fields = errorFields(error);
  const raw = [fields.name, fields.message, fields.details, fields.hint, fields.code].filter(Boolean).join(" ").toLowerCase();
  return [
    "load failed",
    "failed to fetch",
    "fetch failed",
    "networkerror",
    "network error",
    "network request failed",
    "internet connection appears to be offline",
    "the operation couldn",
    "connection lost",
    "connection reset",
    "timeout",
    "timed out",
    "temporarily unavailable",
    "service unavailable",
    "gateway timeout",
    "bad gateway",
  ].some((needle) => raw.includes(needle));
}

function syncError(prefix: string, error: unknown) {
  const fields = errorFields(error);
  const parts = [fields.message, fields.details, fields.code ? `codigo ${fields.code}` : null].filter(Boolean);
  return `${prefix}: ${parts.join(" - ") || "erro desconhecido"}`;
}
function notify() {
  const c = queueSize();
  listeners.forEach((l) => l(c));
}

export function queueSize(): number {
  return readAnswers().length + readQualityAnswers().length + readOps().length;
}

export function getLastSyncError(): SyncLastError | null {
  return readLastError();
}

export function getQueueEntries(): QueueEntrySummary[] {
  const checklistAnswers = readAnswers().map((entry) => ({
    id: entry.id,
    type: "checklist_answer" as const,
    title: "Resposta de checklist",
    detail: `${entry.local_photo_scope ? "Com foto pendente - " : ""}${entry.status.replace("_", " ")}`,
    queuedAt: entry.queued_at,
  }));
  const qualityAnswers = readQualityAnswers().map((entry) => ({
    id: entry.id ?? `${entry.audit_id}-${entry.item_id}`,
    type: "quality_answer" as const,
    title: "Resposta de auditoria",
    detail: `${entry.local_photo_scope ? "Com foto pendente - " : ""}${entry.answer.replace("_", " ")}`,
    queuedAt: entry.queued_at ?? Date.now(),
  }));
  const ops = readOps().map((entry) => ({
    id: entry.id,
    type: entry.kind,
    title: entry.kind === "finalize_execution" ? "Finalizacao de checklist" : "Finalizacao de auditoria",
    detail: entry.kind === "finalize_execution" ? `Nota ${entry.score}%` : `${entry.sector_rows.length} area(s), nota ${entry.score}%`,
    queuedAt: entry.queued_at,
  }));
  return [...checklistAnswers, ...qualityAnswers, ...ops].sort((a, b) => a.queuedAt - b.queuedAt);
}

export function clearQueue() {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(ANSWERS_KEY);
  localStorage.removeItem(QUALITY_ANSWERS_KEY);
  localStorage.removeItem(OPS_KEY);
  localStorage.removeItem(ERROR_KEY);
  notify();
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  fn(queueSize());
  return () => { listeners.delete(fn); };
}

export function isOffline(): boolean {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

export function enqueueAnswer(a: Omit<QueuedAnswer, "id" | "queued_at">) {
  const list = readAnswers();
  const filtered = list.filter((x) => !(x.execution_id === a.execution_id && x.item_id === a.item_id));
  filtered.push({ ...a, id: crypto.randomUUID(), queued_at: Date.now() });
  writeAnswers(filtered);
}

export function enqueueQualityAnswer(a: Omit<QueuedAuditAnswer, "id" | "queued_at">) {
  const list = readQualityAnswers();
  const filtered = list.filter((x) => !(x.audit_id === a.audit_id && x.item_id === a.item_id));
  filtered.push({ ...a, id: crypto.randomUUID(), queued_at: Date.now() });
  writeQualityAnswers(filtered);
}

export function getQueuedAnswersForExecution(executionId: string): QueuedAnswer[] {
  return readAnswers().filter((x) => x.execution_id === executionId);
}

export function getQueuedQualityAnswersForAudit(auditId: string): QueuedAuditAnswer[] {
  return readQualityAnswers().filter((x) => x.audit_id === auditId);
}

export function enqueueFinalizeExecution(op: Omit<FinalizeExecutionOp, "id" | "queued_at" | "kind">) {
  const list = readOps().filter(
    (o) => !(o.kind === "finalize_execution" && o.execution_id === op.execution_id),
  );
  list.push({ kind: "finalize_execution", id: crypto.randomUUID(), queued_at: Date.now(), ...op });
  writeOps(list);
}

export function enqueueFinalizeAudit(op: Omit<FinalizeAuditOp, "id" | "queued_at" | "kind">) {
  const list = readOps().filter(
    (o) => !(o.kind === "finalize_audit" && o.audit_id === op.audit_id),
  );
  list.push({ kind: "finalize_audit", id: crypto.randomUUID(), queued_at: Date.now(), ...op });
  writeOps(list);
}

let flushing = false;
export async function flushQueue(): Promise<{ sent: number; failed: number; deferred?: boolean }> {
  if (flushing) return { sent: 0, failed: 0 };
  if (isOffline()) return { sent: 0, failed: 0 };
  flushing = true;
  let sent = 0;
  let failed = 0;
  try {
    // 1) Respostas de checklist (devem ir antes da finalização)
    let answers = readAnswers();
    for (const entry of answers.slice()) {
      const { data, error } = await supabase.from("checklist_answers").upsert(
        {
          execution_id: entry.execution_id,
          item_id: entry.item_id,
          status: entry.status,
          observation: entry.observation,
          justification: entry.justification,
          answered_by: entry.answered_by,
          answered_at: entry.answered_at,
        },
        { onConflict: "execution_id,item_id" },
      ).select("id");
      if (error) {
        const message = syncError("Falha ao sincronizar resposta de checklist", error);
        if (isRetryableSyncError(error)) {
          writeLastError(message, true);
          return { sent, failed: 0, deferred: true };
        }
        failed++;
        writeLastError(message);
        break;
      }
      const answerId = data?.[0]?.id as string | undefined;
      if (entry.local_photo_scope && answerId) {
        const uploaded = await uploadLocalEvidencePhotos(
          entry.local_photo_scope,
          answerId,
          `checklists/${entry.execution_id}/${entry.item_id}`,
          entry.answered_by,
        );
        if (uploaded.failed) {
          const message = uploaded.error ?? "Falha ao sincronizar foto de checklist.";
          if (isRetryableSyncError(message)) {
            writeLastError(message, true);
            return { sent, failed: 0, deferred: true };
          }
          failed++;
          writeLastError(message);
          break;
        }
      }
      sent++;
      answers = readAnswers().filter((x) => x.id !== entry.id);
      writeAnswers(answers);
    }
    if (failed > 0) return { sent, failed };

    // 2) Operações (finalizações)
    let qualityAnswers = readQualityAnswers();
    for (const entry of qualityAnswers.slice()) {
      const { data, error } = await supabase
        .from("quality_audit_answers")
        .upsert({
          audit_id: entry.audit_id,
          sector_id: entry.sector_id,
          item_id: entry.item_id,
          answer: entry.answer,
          observation: entry.observation,
          justification: entry.justification,
        }, { onConflict: "audit_id,item_id" })
        .select("id");
      if (error) {
        const message = syncError("Falha ao sincronizar resposta da auditoria", error);
        if (isRetryableSyncError(error)) {
          writeLastError(message, true);
          return { sent, failed: 0, deferred: true };
        }
        failed++;
        writeLastError(message);
        break;
      }
      const answerId = data?.[0]?.id as string | undefined;
      if (entry.local_photo_scope && answerId) {
        const { data: userData } = await supabase.auth.getUser();
        const uploaded = await uploadLocalEvidencePhotos(
          entry.local_photo_scope,
          answerId,
          `quality/${entry.audit_id}/${entry.item_id}`,
          userData.user?.id,
          "quality",
        );
        if (uploaded.failed) {
          const message = uploaded.error ?? "Falha ao sincronizar foto da auditoria.";
          if (isRetryableSyncError(message)) {
            writeLastError(message, true);
            return { sent, failed: 0, deferred: true };
          }
          failed++;
          writeLastError(message);
          break;
        }
      }
      sent++;
      qualityAnswers = readQualityAnswers().filter((x) => x.id !== entry.id);
      writeQualityAnswers(qualityAnswers);
    }
    if (failed > 0) return { sent, failed };

    let ops = readOps();
    for (const op of ops.slice()) {
      const result = await runOp(op);
      if (!result.ok) {
        if (result.retryable) {
          writeLastError(result.error ?? "Aguardando conexao estavel para sincronizar.", true);
          return { sent, failed: 0, deferred: true };
        }
        failed++;
        writeLastError(result.error ?? "Falha ao sincronizar alteracao pendente.");
        break;
      }
      sent++;
      ops = readOps().filter((x) => x.id !== op.id);
      writeOps(ops);
    }
    if (queueSize() === 0) clearLastError();
  } catch (error) {
    const message = syncError("Falha ao sincronizar alteracao pendente", error);
    if (isRetryableSyncError(error)) {
      writeLastError(message, true);
      return { sent, failed: 0, deferred: true };
    }
    failed++;
    writeLastError(message);
    return { sent, failed };
  } finally {
    flushing = false;
  }
  return { sent, failed };
}

async function isChecklistExecutionDone(executionId: string) {
  const existing = await supabase
    .from("checklist_executions")
    .select("status")
    .eq("id", executionId)
    .maybeSingle();
  return existing.data?.status === "concluido";
}

async function isQualityAuditDone(auditId: string) {
  const existing = await supabase
    .from("quality_audits")
    .select("status")
    .eq("id", auditId)
    .maybeSingle();
  return existing.data?.status === "concluido";
}

async function runOp(op: Op): Promise<{ ok: boolean; error?: string; retryable?: boolean }> {
  if (op.kind === "finalize_execution") {
    const { error } = await supabase
      .from("checklist_executions")
      .update({ status: "concluido", finished_at: op.finished_at, score: op.score })
      .eq("id", op.execution_id);
    if (!error) return { ok: true };
    if (isRetryableSyncError(error)) {
      return { ok: false, error: syncError("Falha ao finalizar checklist", error), retryable: true };
    }
    if (await isChecklistExecutionDone(op.execution_id)) return { ok: true };
    return { ok: false, error: syncError("Falha ao finalizar checklist", error) };
  }
  if (op.kind === "finalize_audit") {
    if (op.answers.length) {
      const answers = op.answers.map((answer) => ({
        audit_id: answer.audit_id,
        sector_id: answer.sector_id,
        item_id: answer.item_id,
        answer: answer.answer,
        observation: answer.observation,
        justification: answer.justification,
      }));
      const { error } = await supabase
        .from("quality_audit_answers")
        .upsert(answers, { onConflict: "audit_id,item_id" });
      if (error) {
        if (isRetryableSyncError(error)) {
          return { ok: false, error: syncError("Falha ao salvar respostas da auditoria", error), retryable: true };
        }
        if (await isQualityAuditDone(op.audit_id)) return { ok: true };
        return { ok: false, error: syncError("Falha ao salvar respostas da auditoria", error) };
      }
    }
    if (op.sector_rows.length) {
      const { error } = await supabase
        .from("quality_audit_sectors")
        .upsert(op.sector_rows, { onConflict: "audit_id,sector_id" });
      if (error) {
        if (isRetryableSyncError(error)) {
          return { ok: false, error: syncError("Falha ao salvar nota da area", error), retryable: true };
        }
        if (!(await isQualityAuditDone(op.audit_id))) {
          return { ok: false, error: syncError("Falha ao salvar nota da area", error) };
        }
      }
    }
    const { error: uErr } = await supabase.from("quality_audits").update({
      status: "concluido",
      finished_at: op.finished_at,
      score: op.score,
      auditor_signature: op.auditor_signature,
    }).eq("id", op.audit_id);
    if (uErr) {
      if (isRetryableSyncError(uErr)) {
        return { ok: false, error: syncError("Falha ao finalizar auditoria", uErr), retryable: true };
      }
      if (!(await isQualityAuditDone(op.audit_id))) {
        return { ok: false, error: syncError("Falha ao finalizar auditoria", uErr) };
      }
    }
    if (op.action_plans.length) {
      // Re-mapeia para incluir quality_answer_id atual
      const answersRes = await supabase.from("quality_audit_answers")
        .select("id, item_id").eq("audit_id", op.audit_id);
      const idByItem = Object.fromEntries((answersRes.data ?? []).map((r) => [r.item_id, r.id]));
      const plans = op.action_plans.map((p) => ({
        quality_audit_id: p.quality_audit_id,
        quality_answer_id: idByItem[p.item_id] ?? null,
        description: p.description,
        status: p.status,
        created_by: p.created_by,
      }));
      const { error } = await supabase.from("action_plans").insert(plans);
      if (error) console.warn("Falha ao sincronizar planos de acao da auditoria", error);
    }
    void saveQualityReportSnapshotForAudit(op.audit_id).catch((error) => {
      console.warn("Falha ao preparar snapshot do relatorio da auditoria", error);
    });
    return { ok: true };
  }
  return { ok: false, error: "Tipo de alteracao pendente desconhecido." };
}

let initialized = false;
let flushTimer: number | undefined;

function scheduleFlush(delayMs = 0) {
  if (typeof window === "undefined") return;
  window.clearTimeout(flushTimer);
  flushTimer = window.setTimeout(() => {
    if (navigator.onLine && queueSize() > 0) void flushQueue();
  }, delayMs);
}

export function initOfflineSync() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  window.addEventListener("online", () => { scheduleFlush(2_000); });
  scheduleFlush(1_000);
  setInterval(() => {
    if (navigator.onLine && queueSize() > 0) scheduleFlush();
  }, 30_000);
}
