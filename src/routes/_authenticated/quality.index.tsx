import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck, Play, ChevronRight, Loader2, Plus, Settings2, Trash2, AlertTriangle, Pencil, Copy, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { isoWeek, weekOfMonth, parseBands, classifyScore, DEFAULT_BANDS, type ScoreBands } from "@/lib/quality";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SortableList } from "@/components/SortableList";
import { usePerfil } from "@/lib/perfil";
import { RequirePerfil } from "@/components/RequirePerfil";


export const Route = createFileRoute("/_authenticated/quality/")({
  component: () => <RequirePerfil allow={["gestor", "auditor"]}><QualityHome /></RequirePerfil>,
});

function QualityHome() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showAdmin, setShowAdmin] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const { canRunQualityAudit, canConfigureQuality, isGestor } = usePerfil();

  const areasQ = useQuery({
    queryKey: ["q-areas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quality_areas")
        .select("id, name, slug, target_score, position, is_active, sectors:quality_sectors(id, name, slug, position, target_score, is_active, items:quality_items!quality_items_sector_id_fkey(id, is_active))")
        .order("position");
      if (error) throw error;
      return data ?? [];
    },
  });

  const openAuditsQ = useQuery({
    queryKey: ["q-open-audits"],
    enabled: canRunQualityAudit,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quality_audits")
        .select("id, iso_year, iso_week, week_of_month, month, year, started_at, status, auditor_id")
        .eq("status", "em_andamento")
        .order("started_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const createMut = useMutation({
    mutationFn: async (startSectorId?: string) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Sem usuário");
      const now = new Date();
      const iw = isoWeek(now);
      const { data, error } = await supabase.from("quality_audits").insert({
        auditor_id: userData.user.id,
        iso_year: iw.year, iso_week: iw.week,
        month: now.getMonth() + 1, year: now.getFullYear(),
        week_of_month: weekOfMonth(now),
        status: "em_andamento",
      }).select("id").single();
      if (error) throw error;
      return { id: data.id as string, startSectorId: startSectorId ?? null };
    },
    onSuccess: ({ id, startSectorId }) => {
      if (startSectorId) {
        sessionStorage.setItem(`quality-start-sector:${id}`, startSectorId);
      }
      qc.invalidateQueries();
      navigate({ to: "/quality/audit/$id", params: { id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteAuditMut = useMutation({
    mutationFn: async (auditId: string) => {
      const ok = confirm("Excluir esta auditoria em andamento? Esta acao nao pode ser desfeita.");
      if (!ok) return false;
      const { error } = await supabase
        .from("quality_audits")
        .delete()
        .eq("id", auditId)
        .eq("status", "em_andamento");
      if (error) throw error;
      return true;
    },
    onSuccess: (deleted) => {
      if (!deleted) return;
      toast.success("Auditoria em andamento excluida.");
      qc.invalidateQueries({ queryKey: ["q-open-audits"] });
      qc.invalidateQueries({ queryKey: ["quality-reports"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const activeAreas = (areasQ.data ?? []).filter((a) => a.is_active);
  const activeSectors = activeAreas.flatMap((a) =>
    (a.sectors ?? [])
      .filter((s) => s.is_active)
      .map((s) => ({
        id: s.id,
        name: s.name,
        areaName: a.name,
        itemCount: s.items?.filter((it) => it.is_active).length ?? 0,
      }))
      .filter((s) => s.itemCount > 0),
  );
  const areasErrorMessage = areasQ.error instanceof Error ? areasQ.error.message : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><ShieldCheck className="w-6 h-6 text-primary"/> Auditoria de Qualidade</h1>
          <p className="text-sm text-muted-foreground">Auditoria semanal por setor e área. A 4ª semana do mês fecha o relatório mensal.</p>
        </div>
        <div className="flex gap-2">
          {canConfigureQuality && (
            <Button variant="outline" onClick={() => setShowAdmin((v) => !v)} className="gap-2"><Settings2 className="w-4 h-4"/> {showAdmin ? "Ocultar configuração" : "Configurar itens"}</Button>
          )}
          {canRunQualityAudit && (
            <Button
              onClick={() => setStartOpen(true)}
              disabled={createMut.isPending || areasQ.isLoading}
              className="brand-gradient gap-2"
            >
              {createMut.isPending ? <Loader2 className="w-4 h-4 animate-spin"/> : <Play className="w-4 h-4"/>} Nova auditoria
            </Button>
          )}
        </div>
      </div>

      {/* Open audits */}
      {canRunQualityAudit && (openAuditsQ.data ?? []).length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Em andamento</h2>
          <div className="grid gap-2">
            {openAuditsQ.data!.map((a) => (
              <div key={a.id} className="card-elevated p-2 flex items-center gap-2 hover:shadow-lg">
                <Link to="/quality/audit/$id" params={{ id: a.id }} className="flex-1 min-w-0 p-2 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl brand-gradient grid place-items-center"><Play className="w-5 h-5"/></div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">Semana {a.iso_week}/{a.iso_year} · {a.week_of_month}ª do mês</div>
                  <div className="text-xs text-muted-foreground">Iniciada em {format(new Date(a.started_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground"/>
                </Link>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={deleteAuditMut.isPending}
                  onClick={() => deleteAuditMut.mutate(a.id)}
                  className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Excluir auditoria em andamento"
                  title="Excluir auditoria em andamento"
                >
                  {deleteAuditMut.isPending ? <Loader2 className="w-4 h-4 animate-spin"/> : <Trash2 className="w-4 h-4"/>}
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Areas snapshot */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Setores e áreas</h2>
        {areasQ.isLoading ? (
          <div className="p-6 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground"/></div>
        ) : areasErrorMessage ? (
          <div className="card-elevated p-4 text-sm text-destructive md:col-span-2">
            Nao consegui carregar setores e areas. {areasErrorMessage}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {(areasQ.data ?? []).map((a) => (
              <div key={a.id} className={`card-elevated p-4 ${a.is_active ? "" : "opacity-70"}`}>
                <div className="flex items-center justify-between">
                  <div className="font-bold flex items-center gap-2">
                    {a.name}
                    {!a.is_active && <span className="text-[10px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground">inativa</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">meta {Number(a.target_score)}%</div>
                </div>
                <ul className="mt-2 text-sm space-y-1">
                  {a.sectors?.map((s) => (
                    <li key={s.id} className="flex items-center justify-between">
                      <span className={s.is_active ? "" : "text-muted-foreground"}>
                        {s.name}
                        {!s.is_active && <span className="ml-2 text-[10px] rounded-full bg-muted px-2 py-0.5">inativo</span>}
                      </span>
                      <span className="text-xs text-muted-foreground">{s.items?.filter((it) => it.is_active).length ?? 0} itens ativos</span>
                    </li>
                  ))}
                  {(!a.sectors || a.sectors.length === 0) && <li className="text-xs text-muted-foreground">Sem setores cadastrados.</li>}
                </ul>
              </div>
            ))}
            {(areasQ.data ?? []).length === 0 && (
              <div className="card-elevated p-4 text-sm text-muted-foreground md:col-span-2">
                Nenhuma area cadastrada na auditoria de qualidade.
              </div>
            )}
          </div>
        )}
      </section>

      <div className="grid gap-3 md:grid-cols-2">
        <Link to="/quality/reports" className="card-elevated p-5 hover:shadow-lg flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary grid place-items-center"><ShieldCheck className="w-5 h-5"/></div>
          <div className="flex-1"><div className="font-semibold">Relatórios de qualidade</div><div className="text-xs text-muted-foreground">Semanais e consolidado mensal</div></div>
          <ChevronRight className="w-5 h-5 text-muted-foreground"/>
        </Link>
      </div>

      {showAdmin && isGestor && <MetasFaixasPanel />}
      {showAdmin && canConfigureQuality && <QualityAdmin areas={areasQ.data ?? []} onChanged={() => qc.invalidateQueries({ queryKey: ["q-areas"] })} />}

      {startOpen && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onClick={() => !createMut.isPending && setStartOpen(false)}/>
          <div className="absolute inset-x-0 bottom-0 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[560px] bg-card rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[88vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <div className="font-bold">Escolha o setor inicial</div>
                <div className="text-xs text-muted-foreground">Depois voce pode continuar por qualquer outro setor.</div>
              </div>
              <button type="button" onClick={() => !createMut.isPending && setStartOpen(false)} className="rounded-lg p-2 hover:bg-muted" aria-label="Fechar">
                <X className="w-5 h-5"/>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 grid gap-2">
              {activeSectors.length === 0 && (
                <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                  {areasErrorMessage
                    ? `Nao consegui carregar os setores: ${areasErrorMessage}`
                    : 'Existem areas/setores cadastrados, mas nenhum setor ativo com itens ativos para iniciar. Abra "Configurar itens" e marque as areas e setores como ativos.'}
                </div>
              )}
              {activeSectors.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  disabled={createMut.isPending || s.itemCount === 0}
                  onClick={() => createMut.mutate(s.id)}
                  className="w-full text-left rounded-xl border border-border p-3 hover:bg-muted disabled:opacity-60 disabled:hover:bg-transparent flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-xl brand-gradient grid place-items-center shrink-0"><Play className="w-5 h-5"/></div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{s.name}</div>
                    <div className="text-xs text-muted-foreground">{s.areaName} · {s.itemCount} item(ns)</div>
                  </div>
                  {createMut.isPending ? <Loader2 className="w-4 h-4 animate-spin"/> : <ChevronRight className="w-4 h-4 text-muted-foreground"/>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type Area = { id: string; name: string; slug: string; position: number; target_score: number; is_active: boolean; sectors: Array<{ id: string; name: string; slug: string; position: number; target_score: number; is_active: boolean; items: Array<{ id: string; is_active: boolean }> | null }> | null };

function normalizeQualityName(name: string) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

const KITCHEN_HOT_SUBSECTORS = new Set(["higiene de panelas", "camara refrigerada cozinha"]);

function MetasFaixasPanel() {
  const qc = useQueryClient();
  const settingsQ = useQuery({
    queryKey: ["restaurant-settings-bands"],
    queryFn: async () => {
      const { data, error } = await supabase.from("restaurant_settings").select("score_bands").eq("id", 1).single();
      if (error) throw error;
      return parseBands(data.score_bands);
    },
  });
  const [draft, setDraft] = useState<ScoreBands | null>(null);
  const bands = draft ?? settingsQ.data ?? DEFAULT_BANDS;

  async function save() {
    if (!draft) return;
    if (!(draft.excelente > draft.bom && draft.bom > draft.atencao)) {
      return toast.error("As faixas devem ser: Excelente > Bom > Atenção");
    }
    const { error } = await supabase.from("restaurant_settings").update({ score_bands: draft }).eq("id", 1);
    if (error) return toast.error(error.message);
    toast.success("Faixas atualizadas");
    setDraft(null);
    qc.invalidateQueries({ queryKey: ["restaurant-settings-bands"] });
  }

  const preview = [100, 95, 85, 75, 60];

  return (
    <section className="card-elevated p-4 space-y-3">
      <div className="flex items-center gap-2"><Settings2 className="w-4 h-4"/> <h2 className="font-bold">Metas e faixas de pontuação</h2></div>
      <p className="text-xs text-muted-foreground">Defina o limite inferior (%) para cada classificação. Abaixo de "Atenção" é considerado "Ruim".</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <label className="text-xs space-y-1"><span className="font-medium">Excelente ≥</span>
          <Input type="number" min={0} max={100} step="0.01" value={bands.excelente}
            onChange={(e) => setDraft({ ...bands, excelente: Number(e.target.value) })}/>
        </label>
        <label className="text-xs space-y-1"><span className="font-medium">Bom ≥</span>
          <Input type="number" min={0} max={100} step="0.01" value={bands.bom}
            onChange={(e) => setDraft({ ...bands, bom: Number(e.target.value) })}/>
        </label>
        <label className="text-xs space-y-1"><span className="font-medium">Atenção ≥</span>
          <Input type="number" min={0} max={100} step="0.01" value={bands.atencao}
            onChange={(e) => setDraft({ ...bands, atencao: Number(e.target.value) })}/>
        </label>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        {preview.map((p) => {
          const c = classifyScore(p, bands);
          return <span key={p} className={`px-2 py-1 rounded border ${c.className}`}>{p}% · {c.label}</span>;
        })}
      </div>
      {draft && (
        <div className="flex gap-2 justify-end">
          <Button size="sm" variant="outline" onClick={() => setDraft(null)}>Cancelar</Button>
          <Button size="sm" className="brand-gradient" onClick={save}>Salvar faixas</Button>
        </div>
      )}
    </section>
  );
}

function QualityAdmin({ areas, onChanged }: { areas: Area[]; onChanged: () => void }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);

  const [newArea, setNewArea] = useState("");
  const [newSector, setNewSector] = useState<Record<string, string>>({});
  const [createType, setCreateType] = useState<"area" | "setor">("area");
  const [createName, setCreateName] = useState("");
  const [createAreaId, setCreateAreaId] = useState<string>("");
  const slugify = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const copySlug = (s: string) => {
    const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const base = slugify(s).slice(0, Math.max(1, 59 - suffix.length));
    return `${base || "copia"}-${suffix}`;
  };

  function friendlyEntityError(error: { message?: string } | null, type: "area" | "setor", name: string) {
    const message = error?.message ?? "";
    if (message.includes("duplicate key") || message.includes("quality_areas_slug_key")) {
      return `Já existe uma área com o nome "${name}". Use outro nome ou edite a área existente.`;
    }
    if (message.includes("quality_sectors") || message.includes("area_id_slug")) {
      return `Já existe um setor com o nome "${name}" nesta área. Use outro nome ou edite o setor existente.`;
    }
    return message || `Não foi possível salvar este ${type}.`;
  }

  async function validateAreaName(name: string, currentId?: string) {
    const slug = slugify(name);
    if (!slug) return "Informe um nome com letras ou números.";
    const { data, error } = await supabase.from("quality_areas").select("id").eq("slug", slug).maybeSingle();
    if (error) return `Não foi possível validar o nome da área: ${error.message}`;
    if (data && data.id !== currentId) return `Já existe uma área com o nome "${name}". Use outro nome ou edite a área existente.`;
    return null;
  }

  async function validateSectorName(areaId: string, name: string, currentId?: string) {
    const slug = slugify(name);
    if (!slug) return "Informe um nome com letras ou números.";
    const { data, error } = await supabase.from("quality_sectors").select("id").eq("area_id", areaId).eq("slug", slug).maybeSingle();
    if (error) return `Não foi possível validar o nome do setor: ${error.message}`;
    if (data && data.id !== currentId) return `Já existe um setor com o nome "${name}" nesta área. Use outro nome ou edite o setor existente.`;
    return null;
  }

  async function createEntity() {
    const name = createName.trim();
    if (!name) return toast.error("Informe um nome");
    if (createType === "area") {
      const validationError = await validateAreaName(name);
      if (validationError) return toast.error(validationError);
      const { error } = await supabase.from("quality_areas").insert({ name, slug: slugify(name), position: areas.length + 1 });
      if (error) return toast.error(friendlyEntityError(error, "area", name));
    } else {
      if (!createAreaId) return toast.error("Selecione a área");
      const validationError = await validateSectorName(createAreaId, name);
      if (validationError) return toast.error(validationError);
      const area = areas.find((a) => a.id === createAreaId);
      const { error } = await supabase.from("quality_sectors").insert({ area_id: createAreaId, name, slug: slugify(name), position: (area?.sectors?.length ?? 0) + 1 });
      if (error) return toast.error(friendlyEntityError(error, "setor", name));
    }
    setCreateName(""); onChanged();
  }
  async function renameArea(id: string, current: string) {
    const name = prompt("Novo nome da área", current)?.trim();
    if (!name || name === current) return;
    const validationError = await validateAreaName(name, id);
    if (validationError) return toast.error(validationError);
    const { error } = await supabase.from("quality_areas").update({ name, slug: slugify(name) }).eq("id", id);
    if (error) return toast.error(friendlyEntityError(error, "area", name)); onChanged();
  }
  async function renameSector(id: string, current: string) {
    const name = prompt("Novo nome do setor", current)?.trim();
    if (!name || name === current) return;
    const ownerArea = areas.find((area) => area.sectors?.some((item) => item.id === id));
    if (!ownerArea) return toast.error("Não encontrei a área do setor para renomear.");
    const validationError = await validateSectorName(ownerArea.id, name, id);
    if (validationError) return toast.error(validationError);
    const { error } = await supabase.from("quality_sectors").update({ name, slug: slugify(name) }).eq("id", id);
    if (error) return toast.error(friendlyEntityError(error, "setor", name)); onChanged();
  }


  async function addArea() {
    const name = newArea.trim();
    if (!name) return;
    const validationError = await validateAreaName(name);
    if (validationError) return toast.error(validationError);
    const slug = slugify(name);
    const { error } = await supabase.from("quality_areas").insert({ name, slug, position: areas.length + 1 });
    if (error) return toast.error(friendlyEntityError(error, "area", name));
    setNewArea(""); onChanged();
  }
  async function delArea(id: string) {
    if (!confirm("Excluir setor e todas as áreas/itens?")) return;
    const { error } = await supabase.from("quality_areas").delete().eq("id", id);
    if (error) return toast.error(error.message); onChanged();
  }
  async function updateAreaTarget(id: string, value: number) {
    const { error } = await supabase.from("quality_areas").update({ target_score: value }).eq("id", id);
    if (error) return toast.error(error.message); onChanged();
  }
  async function toggleAreaActive(id: string, next: boolean) {
    const { data, error } = await supabase
      .from("quality_areas")
      .update({ is_active: next })
      .eq("id", id)
      .select("id, is_active");
    if (error) return toast.error(error.message);
    const updated = data?.find((area) => area.id === id);
    if (!updated) return toast.error("Não consegui alterar a área. Verifique se o perfil auditor está liberado no banco.");
    if (updated.is_active !== next) return toast.error("Não consegui alterar o status da área.");
    qc.setQueryData<Area[]>(["q-areas"], (old) =>
      old?.map((area) => area.id === id ? { ...area, is_active: next } : area),
    );
    toast.success(next ? "Área ativada" : "Área desativada");
    onChanged();
  }

  async function duplicateArea(area: Area) {
    const copyName = `Cópia de ${area.name}`;
    const { data: newArea, error } = await supabase
      .from("quality_areas")
      .insert({
        name: copyName,
        slug: copySlug(copyName),
        target_score: Number(area.target_score ?? 90),
        position: areas.length + 1,
        is_active: false,
      })
      .select("id")
      .single();
    if (error) return toast.error(error.message);

    const { data: sectors, error: sectorsError } = await supabase
      .from("quality_sectors")
      .select("id, name, target_score, is_active")
      .eq("area_id", area.id)
      .order("position");
    if (sectorsError) {
      onChanged();
      return toast.error(`Auditoria criada, mas não consegui copiar as áreas: ${sectorsError.message}`);
    }

    for (const [sectorIndex, sector] of (sectors ?? []).entries()) {
      const { data: newSector, error: newSectorError } = await supabase
        .from("quality_sectors")
        .insert({
          area_id: newArea.id,
          name: sector.name,
          slug: copySlug(`${copyName}-${sector.name}`),
          position: sectorIndex + 1,
          target_score: Number(sector.target_score ?? 90),
          is_active: Boolean(sector.is_active),
        })
        .select("id")
        .single();
      if (newSectorError) {
        onChanged();
        return toast.error(`Auditoria criada, mas não consegui copiar uma área: ${newSectorError.message}`);
      }

      const { data: items, error: itemsError } = await supabase
        .from("quality_items")
        .select("title, guidance, weight, is_critical, requires_photo, position, is_active, score_sector_id")
        .eq("sector_id", sector.id)
        .order("position");
      if (itemsError) {
        onChanged();
        return toast.error(`Auditoria criada, mas não consegui copiar as perguntas: ${itemsError.message}`);
      }

      if (items?.length) {
        const { error: copyItemsError } = await supabase.from("quality_items").insert(
          items.map((item, itemIndex) => ({
            sector_id: newSector.id,
            title: item.title,
            guidance: item.guidance,
            weight: Number(item.weight ?? 1),
            is_critical: Boolean(item.is_critical),
            requires_photo: Boolean(item.requires_photo),
            is_active: Boolean(item.is_active),
            score_sector_id: item.score_sector_id,
            position: itemIndex + 1,
          })),
        );
        if (copyItemsError) {
          onChanged();
          return toast.error(`Auditoria criada, mas não consegui copiar as perguntas: ${copyItemsError.message}`);
        }
      }
    }

    toast.success("Auditoria duplicada. A cópia foi criada inativa para revisão.");
    setExpanded(newArea.id);
    onChanged();
  }

  async function updateSectorTarget(id: string, value: number) {
    const { error } = await (supabase.from("quality_sectors") as unknown as { update: (v: { target_score: number }) => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> } }).update({ target_score: value }).eq("id", id);
    if (error) return toast.error(error.message); onChanged();
  }
  async function toggleSectorActive(id: string, next: boolean) {
    const { data, error } = await supabase
      .from("quality_sectors")
      .update({ is_active: next })
      .eq("id", id)
      .select("id, is_active");
    if (error) return toast.error(error.message);
    const updated = data?.find((sector) => sector.id === id);
    if (!updated) return toast.error("Não consegui alterar a área. Verifique se o perfil auditor está liberado no banco.");
    if (updated.is_active !== next) return toast.error("Não consegui alterar o status da área nas auditorias.");
    qc.setQueryData<Area[]>(["q-areas"], (old) =>
      old?.map((area) => ({
        ...area,
        sectors: area.sectors?.map((sector) => sector.id === id ? { ...sector, is_active: next } : sector) ?? null,
      })),
    );
    toast.success(next ? "Área ativada nas auditorias" : "Área desativada nas auditorias");
    onChanged();
  }
  async function duplicateSector(areaId: string, sector: NonNullable<Area["sectors"]>[number]) {
    const area = areas.find((a) => a.id === areaId);
    const copyName = `Cópia de ${sector.name}`;
    const { data: newSector, error } = await supabase
      .from("quality_sectors")
      .insert({
        area_id: areaId,
        name: copyName,
        slug: copySlug(`${area?.name ?? "area"}-${copyName}`),
        position: (area?.sectors?.length ?? 0) + 1,
        target_score: Number(sector.target_score ?? 90),
        is_active: false,
      })
      .select("id")
      .single();
    if (error) return toast.error(error.message);

    const { data: items, error: itemsError } = await supabase
      .from("quality_items")
      .select("title, guidance, weight, is_critical, requires_photo, position, is_active, score_sector_id")
      .eq("sector_id", sector.id)
      .order("position");
    if (itemsError) {
      onChanged();
      return toast.error(`Área criada, mas não consegui copiar as perguntas: ${itemsError.message}`);
    }

    if (items?.length) {
      const { error: copyItemsError } = await supabase.from("quality_items").insert(
        items.map((item, index) => ({
          sector_id: newSector.id,
          title: item.title,
          guidance: item.guidance,
          weight: Number(item.weight ?? 1),
          is_critical: Boolean(item.is_critical),
          requires_photo: Boolean(item.requires_photo),
          is_active: Boolean(item.is_active),
          score_sector_id: item.score_sector_id,
          position: index + 1,
        })),
      );
      if (copyItemsError) {
        onChanged();
        return toast.error(`Área criada, mas não consegui copiar as perguntas: ${copyItemsError.message}`);
      }
    }

    toast.success("Área duplicada. A cópia foi criada inativa para revisão.");
    onChanged();
  }

  async function addSector(areaId: string) {
    const name = (newSector[areaId] ?? "").trim();
    if (!name) return;
    const validationError = await validateSectorName(areaId, name);
    if (validationError) return toast.error(validationError);
    const slug = slugify(name);
    const area = areas.find((a) => a.id === areaId);
    const { error } = await supabase.from("quality_sectors").insert({ area_id: areaId, name, slug, position: (area?.sectors?.length ?? 0) + 1 });
    if (error) return toast.error(friendlyEntityError(error, "setor", name));
    setNewSector((m) => ({ ...m, [areaId]: "" })); onChanged();
  }
  async function delSector(id: string) {
    if (!confirm("Excluir área e todos os itens?")) return;
    const { error } = await supabase.from("quality_sectors").delete().eq("id", id);
    if (error) return toast.error(error.message); onChanged();
  }
  async function persistAreaOrder(next: Area[]) {
    const ordered = next.map((a, i) => ({ ...a, position: i + 1 }));
    qc.setQueryData<Area[]>(["q-areas"], ordered);
    for (const area of ordered) {
      const { error } = await supabase.from("quality_areas").update({ position: area.position }).eq("id", area.id);
      if (error) {
        toast.error(error.message);
        onChanged();
        return;
      }
    }
    onChanged();
  }
  async function persistSectorOrder(areaId: string, next: NonNullable<Area["sectors"]>) {
    const ordered = next.map((s, i) => ({ ...s, position: i + 1 }));
    qc.setQueryData<Area[]>(["q-areas"], (current) =>
      current?.map((area) => (area.id === areaId ? { ...area, sectors: ordered } : area)),
    );
    for (const sector of ordered) {
      const { error } = await supabase.from("quality_sectors").update({ position: sector.position }).eq("id", sector.id);
      if (error) {
        toast.error(error.message);
        onChanged();
        return;
      }
    }
    onChanged();
  }

  const allSectors = areas.flatMap((area) =>
    (area.sectors ?? []).map((sector) => ({ ...sector, areaName: area.name })),
  );
  const hotKitchenSector = allSectors.find((sector) => normalizeQualityName(sector.name) === "cozinha quente");
  const scoreSectorOptions = allSectors.map((sector) => ({ id: sector.id, name: `${sector.areaName} / ${sector.name}` }));

  function defaultScoreSectorFor(sectorName: string) {
    if (!hotKitchenSector || !KITCHEN_HOT_SUBSECTORS.has(normalizeQualityName(sectorName))) return null;
    return { id: hotKitchenSector.id, name: hotKitchenSector.name };
  }

  return (
    <section className="card-elevated p-4 space-y-4">
      <div className="flex items-center gap-2"><Settings2 className="w-4 h-4"/> <h2 className="font-bold">Configuração de Setores, Áreas e Itens</h2></div>
      <div className="rounded-xl border border-border p-3 space-y-2 bg-muted/30">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Criar novo</div>
        <div className="flex flex-wrap gap-2 items-center">
          <select value={createType} onChange={(e) => setCreateType(e.target.value as "area" | "setor")} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
            <option value="area">Área</option>
            <option value="setor">Setor</option>
          </select>
          {createType === "setor" && (
            <select value={createAreaId} onChange={(e) => setCreateAreaId(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
              <option value="">Selecione a área…</option>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
          <Input value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder={createType === "area" ? "Nome da área (ex.: Cozinha)" : "Nome do setor (ex.: Fritadeira)"} className="flex-1 min-w-[200px]"/>
          <Button onClick={createEntity} className="brand-gradient gap-1"><Plus className="w-4 h-4"/>Criar</Button>
        </div>
      </div>
      <div className="space-y-3">
        <SortableList
          items={areas}
          onReorder={persistAreaOrder}
          renderItem={(a, handle) => (
            <div key={a.id} className="border border-border rounded-xl">
              <div className="p-3 flex flex-wrap items-center gap-x-2 gap-y-2 cursor-pointer hover:bg-muted/40" onClick={() => setExpanded(expanded === a.id ? null : a.id)}>
                {handle}
                <div className="flex-1 min-w-0 basis-full sm:basis-auto text-left font-semibold truncate flex items-center gap-2">
                  <span className="truncate">{a.name}</span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleAreaActive(a.id, !a.is_active); }}
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors ${a.is_active ? "bg-success/20 text-success hover:bg-success/30" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}
                    title={a.is_active ? "Clique para desativar" : "Clique para ativar"}
                  >
                    {a.is_active ? "Ativa" : "Inativa"}
                  </button>

                </div>
                <label className="text-xs text-muted-foreground flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>meta
                  <Input type="number" min={0} max={100} step="0.01" defaultValue={Number(a.target_score)}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={(e) => { const v = Number(e.target.value); if (v !== Number(a.target_score)) updateAreaTarget(a.id, v); }}
                    className="w-20 h-9"/>%
                </label>
                <button onClick={(e) => { e.stopPropagation(); renameArea(a.id, a.name); }} className="shrink-0 min-h-11 min-w-11 grid place-items-center text-primary hover:bg-primary/10 rounded-lg" title="Renomear" aria-label="Renomear área"><Pencil className="w-4 h-4"/></button>
                <button onClick={(e) => { e.stopPropagation(); duplicateArea(a); }} className="shrink-0 min-h-11 min-w-11 grid place-items-center text-primary hover:bg-primary/10 rounded-lg" title="Duplicar auditoria" aria-label="Duplicar auditoria"><Copy className="w-4 h-4"/></button>
                <button onClick={(e) => { e.stopPropagation(); delArea(a.id); }} className="shrink-0 min-h-11 min-w-11 grid place-items-center text-destructive hover:bg-destructive/10 rounded-lg" aria-label="Excluir área"><Trash2 className="w-4 h-4"/></button>

              </div>
              {expanded === a.id && (
                <div className="p-3 border-t border-border space-y-3">
                  <div className="flex gap-2">
                    <Input value={newSector[a.id] ?? ""} onChange={(e) => setNewSector((m) => ({ ...m, [a.id]: e.target.value }))} placeholder="Novo setor"/>
                    <Button onClick={() => addSector(a.id)} variant="outline"><Plus className="w-4 h-4"/></Button>
                  </div>
                  <SortableList
                    items={a.sectors ?? []}
                    onReorder={(next) => persistSectorOrder(a.id, next)}
                    renderItem={(s, sHandle) => (
                      <div key={s.id} className="flex items-start gap-2">
                        {sHandle}
                        <div className="flex-1">
                          {(() => {
                            const defaultScoreSector = defaultScoreSectorFor(s.name);
                            return (
                          <SectorEditor sectorId={s.id} name={s.name} target={Number(s.target_score ?? 80)} isActive={s.is_active}
                            itemCount={s.items?.filter((it) => it.is_active).length ?? 0}
                            scoreSectorOptions={scoreSectorOptions}
                            defaultScoreSectorId={defaultScoreSector?.id ?? null}
                            defaultScoreSectorName={defaultScoreSector?.name ?? null}
                            onDelete={() => delSector(s.id)} onChanged={onChanged}
                            onRename={() => renameSector(s.id, s.name)}
                            onDuplicate={() => duplicateSector(a.id, s)}
                            onTargetChange={(v) => updateSectorTarget(s.id, v)}
                            onActiveChange={(next) => toggleSectorActive(s.id, next)}/>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  />
                </div>
              )}
            </div>
          )}
        />
      </div>
    </section>
  );
}


function SectorEditor({ sectorId, name, target, isActive, itemCount, scoreSectorOptions, defaultScoreSectorId, defaultScoreSectorName, onDelete, onChanged, onTargetChange, onRename, onActiveChange, onDuplicate }: {
  sectorId: string;
  name: string;
  target: number;
  isActive: boolean;
  itemCount: number;
  scoreSectorOptions: Array<{ id: string; name: string }>;
  defaultScoreSectorId?: string | null;
  defaultScoreSectorName?: string | null;
  onDelete: () => void;
  onChanged: () => void;
  onTargetChange: (v: number) => void;
  onRename: () => void;
  onActiveChange: (next: boolean) => void;
  onDuplicate: () => void;
}) {
  const [itemsOpen, setItemsOpen] = useState(false);
  const itemsQ = useQuery({
    queryKey: ["q-items", sectorId],
    enabled: itemsOpen,
    queryFn: async () => {
      const { data, error } = await supabase.from("quality_items")
        .select("id, title, guidance, weight, is_critical, requires_photo, position, is_active, score_sector_id")
        .eq("sector_id", sectorId).eq("is_active", true).order("position");
      if (error) throw error; return data ?? [];
    },
  });
  const [title, setTitle] = useState("");
  const [critical, setCritical] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ title: string; guidance: string; weight: number; is_critical: boolean; score_sector_id: string }>({ title: "", guidance: "", weight: 1, is_critical: false, score_sector_id: "" });

  async function add() {
    if (!title.trim()) return;
    const pos = (itemsQ.data?.length ?? 0) + 1;
    const { error } = await supabase.from("quality_items").insert({ sector_id: sectorId, title: title.trim(), position: pos, weight: 1, is_critical: critical, score_sector_id: defaultScoreSectorId ?? null });
    if (error) return toast.error(error.message);
    setTitle(""); setCritical(false); itemsQ.refetch(); onChanged();
  }
  async function del(id: string) {
    if (!confirm("Excluir este item?")) return;
    const { error } = await supabase.from("quality_items").delete().eq("id", id);
    if (error) return toast.error(error.message); itemsQ.refetch(); onChanged();
  }
  function startEdit(it: { id: string; title: string; guidance: string | null; weight: number; is_critical: boolean; score_sector_id?: string | null }) {
    setEditingId(it.id);
    setDraft({ title: it.title, guidance: it.guidance ?? "", weight: Number(it.weight), is_critical: it.is_critical, score_sector_id: it.score_sector_id ?? defaultScoreSectorId ?? "" });
  }
  async function saveEdit(id: string) {
    if (!draft.title.trim()) return toast.error("Título obrigatório");
    const { error } = await supabase.from("quality_items").update({
      title: draft.title.trim(),
      guidance: draft.guidance.trim() || null,
      weight: draft.weight,
      is_critical: draft.is_critical,
      score_sector_id: draft.score_sector_id || null,
    }).eq("id", id);
    if (error) return toast.error(error.message);
    setEditingId(null); itemsQ.refetch(); onChanged();
  }

  async function duplicateItem(it: NonNullable<typeof itemsQ.data>[number]) {
    const current = itemsQ.data ?? [];
    const copyTitle = `Cópia de ${it.title}`;
    const { data: inserted, error } = await supabase
      .from("quality_items")
      .insert({
        sector_id: sectorId,
        title: copyTitle,
        guidance: it.guidance,
        weight: Number(it.weight ?? 1),
        is_critical: Boolean(it.is_critical),
        requires_photo: Boolean(it.requires_photo),
        is_active: true,
        score_sector_id: it.score_sector_id ?? defaultScoreSectorId ?? null,
        position: current.length + 1,
      })
      .select("id, title, guidance, weight, is_critical, requires_photo, position, is_active, score_sector_id")
      .single();
    if (error) return toast.error(error.message);

    const ordered = current.flatMap((row) => (row.id === it.id ? [row, inserted] : [row]));
    const results = await Promise.all(
      ordered.map((row, index) => supabase.from("quality_items").update({ position: index + 1 }).eq("id", row.id)),
    );
    const orderError = results.find((result) => result.error)?.error;
    if (orderError) toast.warning(`Pergunta duplicada, mas não consegui ajustar a ordem: ${orderError.message}`);

    setEditingId(inserted.id);
    setDraft({
      title: inserted.title,
      guidance: inserted.guidance ?? "",
      weight: Number(inserted.weight),
      is_critical: inserted.is_critical,
      score_sector_id: inserted.score_sector_id ?? "",
    });
    toast.success("Pergunta duplicada");
    itemsQ.refetch();
    onChanged();
  }

  async function persistOrder(next: NonNullable<typeof itemsQ.data>) {
    for (let i = 0; i < next.length; i++) {
      const { error } = await supabase.from("quality_items").update({ position: i + 1 }).eq("id", next[i].id);
      if (error) {
        toast.error(error.message);
        break;
      }
    }
    itemsQ.refetch();
  }

  return (
    <div className={`bg-muted/40 rounded-lg ${isActive ? "" : "opacity-75"}`}>
      <div
        className="flex flex-wrap items-center gap-x-2 gap-y-2 rounded-lg p-3 cursor-pointer hover:bg-card/60"
        onClick={() => setItemsOpen((open) => !open)}
      >
        <button
          type="button"
          className="shrink-0 min-h-9 min-w-9 grid place-items-center text-muted-foreground hover:text-foreground"
          aria-label={itemsOpen ? "Recolher setor" : "Expandir setor"}
          onClick={(e) => { e.stopPropagation(); setItemsOpen((open) => !open); }}
        >
          <ChevronRight className={`w-4 h-4 transition-transform ${itemsOpen ? "rotate-90" : ""}`}/>
        </button>
        <div className="flex-1 min-w-0 basis-full sm:basis-auto font-semibold text-sm truncate">{name}</div>
        {defaultScoreSectorName && <span className="text-[10px] rounded-full bg-primary/10 text-primary px-2 py-1 shrink-0">sub-setor de {defaultScoreSectorName}</span>}
        <span className="text-[11px] text-muted-foreground shrink-0">{itemCount} pergunta(s)</span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onActiveChange(!isActive); }}
          className={`text-[10px] font-semibold px-2 py-1 rounded-full transition-colors ${isActive ? "bg-success/20 text-success hover:bg-success/30" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}
          title={isActive ? "Clique para remover esta área das auditorias" : "Clique para mostrar esta área nas auditorias"}
        >
          {isActive ? "Ativa nas auditorias" : "Inativa nas auditorias"}
        </button>
        <label className="text-[11px] text-muted-foreground flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>meta
          <Input type="number" min={0} max={100} step="0.01" defaultValue={target}
            onClick={(e) => e.stopPropagation()}
            onBlur={(e) => { const v = Number(e.target.value); if (v !== target) onTargetChange(v); }}
            className="w-16 h-9"/>%
        </label>
        <button onClick={(e) => { e.stopPropagation(); onRename(); }} className="shrink-0 min-h-11 min-w-11 grid place-items-center text-primary hover:bg-primary/10 rounded-lg" title="Renomear" aria-label="Renomear setor"><Pencil className="w-4 h-4"/></button>
        <button onClick={(e) => { e.stopPropagation(); onDuplicate(); }} className="shrink-0 min-h-11 min-w-11 grid place-items-center text-primary hover:bg-primary/10 rounded-lg" title="Duplicar área" aria-label="Duplicar área"><Copy className="w-4 h-4"/></button>
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="shrink-0 min-h-11 min-w-11 grid place-items-center text-destructive hover:bg-destructive/10 rounded-lg" aria-label="Excluir setor"><Trash2 className="w-4 h-4"/></button>
      </div>
      {itemsOpen && <div className="border-t border-border p-3">
        {itemsQ.isLoading && <div className="py-4 text-center"><Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground"/></div>}
        <SortableList
          items={itemsQ.data ?? []}
          onReorder={persistOrder}
          renderItem={(it, handle) => editingId === it.id ? (
            <div className="bg-card rounded p-2 space-y-2 border border-primary/40">
              <Input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} placeholder="Título"/>
              <Input value={draft.guidance} onChange={(e) => setDraft((d) => ({ ...d, guidance: e.target.value }))} placeholder="Descrição / orientação (RDC 216)"/>
              <div className="flex flex-wrap gap-2 items-center text-xs">
                <label className="flex items-center gap-1">Peso
                  <Input type="number" min={1} max={10} value={draft.weight} onChange={(e) => setDraft((d) => ({ ...d, weight: Number(e.target.value) || 1 }))} className="w-16 h-8"/>
                </label>
                <label className="flex items-center gap-1"><input type="checkbox" checked={draft.is_critical} onChange={(e) => setDraft((d) => ({ ...d, is_critical: e.target.checked }))}/> Crítico</label>
                <label className="flex items-center gap-1">Pontua em
                  <select
                    value={draft.score_sector_id}
                    onChange={(e) => setDraft((d) => ({ ...d, score_sector_id: e.target.value }))}
                    className="h-8 max-w-[220px] rounded-md border border-input bg-background px-2 text-xs"
                  >
                    <option value="">Própria área auditada</option>
                    {scoreSectorOptions.map((option) => (
                      <option key={option.id} value={option.id}>{option.name}</option>
                    ))}
                  </select>
                </label>
                <div className="ml-auto flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancelar</Button>
                  <Button size="sm" className="brand-gradient" onClick={() => saveEdit(it.id)}>Salvar</Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm bg-card rounded px-2 py-1.5">
              {handle}
              <span className="text-xs text-muted-foreground w-6">{it.position}</span>
              <div className="flex-1 min-w-0">
                <div className="truncate">{it.title}</div>
                {it.guidance && <div className="text-[11px] text-muted-foreground truncate">{it.guidance}</div>}
              </div>
              <span className="text-[11px] text-muted-foreground shrink-0">peso {Number(it.weight)}</span>
              {it.score_sector_id && <span className="text-[10px] rounded-full bg-primary/10 text-primary px-2 py-0.5 shrink-0">pontua {scoreSectorOptions.find((option) => option.id === it.score_sector_id)?.name ?? "outro setor"}</span>}
              {it.is_critical && <span className="critical-badge"><AlertTriangle className="w-3 h-3"/>Crítico</span>}
              <button onClick={() => duplicateItem(it)} className="text-primary hover:bg-primary/10 rounded p-1" title="Duplicar pergunta" aria-label="Duplicar pergunta"><Copy className="w-3.5 h-3.5"/></button>
              <button onClick={() => startEdit(it)} className="text-primary hover:bg-primary/10 rounded p-1" title="Editar"><Pencil className="w-3.5 h-3.5"/></button>
              <button onClick={() => del(it.id)} className="text-destructive hover:bg-destructive/10 rounded p-1" title="Excluir"><Trash2 className="w-3.5 h-3.5"/></button>
            </div>
          )}
        />
        <div className="mt-2 flex flex-wrap gap-2 items-center">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Novo item de auditoria" className="flex-1 min-w-[200px]"/>
        <label className="text-xs flex items-center gap-1"><input type="checkbox" checked={critical} onChange={(e) => setCritical(e.target.checked)}/> Crítico</label>
        <Button onClick={add} variant="outline" size="sm"><Plus className="w-3.5 h-3.5"/></Button>
        </div>
      </div>}
    </div>
  );
}
