import { supabase } from "@/integrations/supabase/client";

const SNAPSHOT_VERSION = 1;

export type QualityReportData = {
  audit: any;
  sectors: any[];
  answers: any[];
  restaurant: { name: string; logo_url: string | null } | null;
  snapshot?: {
    generated_at?: string | null;
  };
};

function isSnapshotUnavailable(error: unknown) {
  const err = error as { code?: string; message?: string } | null;
  const message = err?.message?.toLowerCase() ?? "";
  return err?.code === "42P01"
    || message.includes("quality_report_snapshots")
    || message.includes("schema cache");
}

function normalizeSnapshotPayload(payload: any, generatedAt?: string | null): QualityReportData | null {
  if (!payload || payload.version !== SNAPSHOT_VERSION) return null;
  if (!payload.audit || !Array.isArray(payload.sectors) || !Array.isArray(payload.answers)) return null;
  return {
    audit: payload.audit,
    sectors: payload.sectors,
    answers: payload.answers,
    restaurant: payload.restaurant ?? null,
    snapshot: { generated_at: generatedAt ?? payload.generated_at ?? null },
  };
}

async function loadStoredSnapshot(auditId: string): Promise<QualityReportData | null> {
  const { data, error } = await (supabase as any)
    .from("quality_report_snapshots")
    .select("payload, generated_at")
    .eq("audit_id", auditId)
    .maybeSingle();

  if (error) {
    if (!isSnapshotUnavailable(error)) console.warn("Nao consegui carregar snapshot do relatorio", error);
    return null;
  }

  return normalizeSnapshotPayload(data?.payload, data?.generated_at);
}

export async function loadLiveQualityReportData(auditId: string): Promise<QualityReportData> {
  const [audit, sectors, answers, restaurant] = await Promise.all([
    supabase.from("quality_audits").select("*").eq("id", auditId).single(),
    supabase
      .from("quality_audit_sectors")
      .select("score, total_items, conform, non_conform, na, sector:quality_sectors(id, name, area:quality_areas(id, name, target_score))")
      .eq("audit_id", auditId),
    supabase
      .from("quality_audit_answers")
      .select("id, sector_id, item_id, answer, observation, justification, scoring_sector:quality_sectors!quality_audit_answers_sector_id_fkey(id, name, area:quality_areas(id, name, target_score)), item:quality_items(title, is_critical, weight, position, sector_id, score_sector_id, audited_sector:quality_sectors!quality_items_sector_id_fkey(id, name, area:quality_areas(id, name, target_score)))")
      .eq("audit_id", auditId),
    supabase.from("restaurant_settings").select("name, logo_url").limit(1).maybeSingle(),
  ]);
  if (audit.error) throw audit.error;
  if (sectors.error) throw sectors.error;
  if (answers.error) throw answers.error;
  if (restaurant.error) console.warn("Nao consegui carregar dados do restaurante para o relatorio", restaurant.error);

  const { data: auditor } = audit.data?.auditor_id
    ? await supabase.from("profiles").select("full_name").eq("id", audit.data.auditor_id).maybeSingle()
    : { data: null };

  return {
    audit: { ...audit.data, auditor: auditor ?? null },
    sectors: sectors.data ?? [],
    answers: answers.data ?? [],
    restaurant: restaurant.data ?? null,
  };
}

async function persistSnapshot(auditId: string, report: QualityReportData) {
  if (report.audit?.status !== "concluido") return;
  const { data: userData } = await supabase.auth.getUser();
  const generatedAt = new Date().toISOString();
  const payload = {
    version: SNAPSHOT_VERSION,
    generated_at: generatedAt,
    audit: report.audit,
    sectors: report.sectors,
    answers: report.answers,
    restaurant: report.restaurant,
  };

  const { error } = await (supabase as any)
    .from("quality_report_snapshots")
    .upsert({
      audit_id: auditId,
      payload,
      generated_at: generatedAt,
      generated_by: userData.user?.id ?? null,
    }, { onConflict: "audit_id" });

  if (error && !isSnapshotUnavailable(error)) {
    console.warn("Nao consegui salvar snapshot do relatorio", error);
  }
}

export async function saveQualityReportSnapshotForAudit(auditId: string) {
  const report = await loadLiveQualityReportData(auditId);
  await persistSnapshot(auditId, report);
  return report;
}

export async function loadQualityReportData(auditId: string) {
  const stored = await loadStoredSnapshot(auditId);
  if (stored) return stored;

  const live = await loadLiveQualityReportData(auditId);
  void persistSnapshot(auditId, live);
  return live;
}
