import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, Shield, Users, LayoutGrid, ClipboardList, Settings as SettingsIcon,
  Plus, Pencil, Trash2, ChevronRight, ChevronDown, X, Copy,
} from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect, useRef, type ReactNode } from "react";
import { WEEKDAYS } from "@/lib/schedule";
import { SettingsTab } from "@/components/admin/SettingsTab";
import { SortableList } from "@/components/SortableList";

type AppRole = "admin" | "gestor" | "auditor" | "operador";
const ROLES: AppRole[] = ["admin", "gestor", "auditor", "operador"];
const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Administrador",
  gestor: "Gestor",
  auditor: "Auditor de Qualidade",
  operador: "Operador",
};

type ChecklistKind = "operacional" | "auditoria";
type ItemPriority = "critico" | "alto" | "medio" | "baixo";
const KINDS: ChecklistKind[] = ["operacional", "auditoria"];
const PRIORITIES: ItemPriority[] = ["critico", "alto", "medio", "baixo"];
const PRIORITY_LABEL: Record<ItemPriority, string> = {
  critico: "Crítico", alto: "Alto", medio: "Médio", baixo: "Baixo",
};

function slugify(s: string) {
  return s.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

function copySlug(s: string) {
  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const base = slugify(s).slice(0, Math.max(1, 59 - suffix.length));
  return `${base || "copia"}-${suffix}`;
}

import { RequirePerfil } from "@/components/RequirePerfil";

export const Route = createFileRoute("/_authenticated/admin")({
  component: () => <RequirePerfil allow={["admin"]}><AdminPage /></RequirePerfil>,
});

function AdminPage() {
  const [tab, setTab] = useState<"users" | "sectors" | "templates" | "settings">("users");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Administração</h1>
        <p className="text-sm text-muted-foreground">Gerencie usuários, permissões, setores e checklists.</p>
      </div>

      <div className="flex gap-2 overflow-x-auto">
        <TabBtn active={tab === "users"} onClick={() => setTab("users")} icon={Users} label="Usuários" />
        <TabBtn active={tab === "sectors"} onClick={() => setTab("sectors")} icon={LayoutGrid} label="Setores & Áreas" />
        <TabBtn active={tab === "templates"} onClick={() => setTab("templates")} icon={ClipboardList} label="Checklists" />
        <TabBtn active={tab === "settings"} onClick={() => setTab("settings")} icon={SettingsIcon} label="Configurações" />
      </div>

      {tab === "users" && <UsersTab />}
      {tab === "sectors" && <SectorsTab />}
      {tab === "templates" && <TemplatesTab />}
      {tab === "settings" && <SettingsTab />}
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 h-9 px-4 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
        active ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-muted"
      }`}
    >
      <Icon className="w-4 h-4" /> {label}
    </button>
  );
}

/* ---------- Modal ---------- */
function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={onClose}>
      <div className="w-full sm:max-w-lg bg-background rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-background flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-md"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

const inputCls = "w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";
const btnPrimary = "inline-flex items-center gap-2 h-10 px-4 rounded-md brand-gradient text-sm font-medium text-white hover:opacity-90 disabled:opacity-50";
const btnGhost = "inline-flex items-center gap-2 h-9 px-3 rounded-md text-sm font-medium hover:bg-muted";
const btnDanger = "inline-flex items-center gap-2 h-9 px-3 rounded-md text-sm font-medium text-destructive hover:bg-destructive/10";

/* ---------- Users ---------- */
function UsersTab() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [profiles, roles] = await Promise.all([
        supabase.from("profiles").select("id, full_name, role_label, created_at").order("created_at"),
        supabase.from("user_roles").select("id, user_id, role"),
      ]);
      if (profiles.error) throw profiles.error;
      if (roles.error) throw roles.error;
      const rolesByUser = new Map<string, { id: string; role: AppRole }[]>();
      for (const r of roles.data ?? []) {
        const arr = rolesByUser.get(r.user_id) ?? [];
        arr.push({ id: r.id, role: r.role as AppRole });
        rolesByUser.set(r.user_id, arr);
      }
      return (profiles.data ?? []).map((p) => ({ ...p, roles: rolesByUser.get(p.id) ?? [] }));
    },
  });

  async function toggleRole(userId: string, role: AppRole, hasIt: boolean, rowId?: string) {
    const res = hasIt
      ? await supabase.from("user_roles").delete().eq("id", rowId!)
      : await supabase.from("user_roles").insert({ user_id: userId, role });
    if (res.error) return toast.error(res.error.message);
    toast.success("Permissão atualizada");
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  }

  if (q.isLoading) return <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>;

  return (
    <div className="space-y-3">
      <div className="card-elevated p-3 text-xs text-muted-foreground flex items-start gap-2">
        <Shield className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
        <span>Novos usuários se cadastram pela tela de login. Aqui você ajusta as permissões de cada um.</span>
      </div>
      {q.data!.map((u) => (
        <div key={u.id} className="card-elevated p-4">
          <div className="font-semibold">{u.full_name ?? "Sem nome"}</div>
          <div className="text-xs text-muted-foreground font-mono">{u.id.substring(0, 8)}…</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {ROLES.map((r) => {
              const found = u.roles.find((x) => x.role === r);
              const hasIt = !!found;
              return (
                <button
                  key={r}
                  onClick={() => toggleRole(u.id, r, hasIt, found?.id)}
                  className={`h-8 px-3 rounded-full text-xs font-medium border transition-colors ${
                    hasIt ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"
                  }`}
                >
                  {ROLE_LABEL[r]}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {q.data!.length === 0 && (
        <div className="card-elevated p-8 text-center text-sm text-muted-foreground">Nenhum usuário cadastrado.</div>
      )}
    </div>
  );
}

/* ---------- Sectors & Areas ---------- */
type SectorRow = { id: string; name: string; slug: string; sort_order: number };
type AreaRow = { id: string; sector_id: string; name: string; sort_order: number };

function SectorsTab() {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editSector, setEditSector] = useState<Partial<SectorRow> | null>(null);
  const [editArea, setEditArea] = useState<(Partial<AreaRow> & { sector_id: string }) | null>(null);

  const q = useQuery({
    queryKey: ["admin-sectors-full"],
    queryFn: async () => {
      const [sec, ar] = await Promise.all([
        supabase.from("sectors").select("id, name, slug, sort_order").order("sort_order"),
        supabase.from("areas").select("id, sector_id, name, sort_order").order("sort_order"),
      ]);
      if (sec.error) throw sec.error;
      if (ar.error) throw ar.error;
      const areas = new Map<string, AreaRow[]>();
      for (const a of ar.data ?? []) {
        const arr = areas.get(a.sector_id) ?? [];
        arr.push(a as AreaRow);
        areas.set(a.sector_id, arr);
      }
      return (sec.data ?? []).map((s) => ({ ...s, areas: areas.get(s.id) ?? [] }));
    },
  });

  async function deleteSector(id: string) {
    if (!confirm("Excluir este setor e todas as suas áreas?")) return;
    const { error } = await supabase.from("sectors").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Setor excluído");
    qc.invalidateQueries({ queryKey: ["admin-sectors-full"] });
  }
  async function deleteArea(id: string) {
    if (!confirm("Excluir esta área?")) return;
    const { error } = await supabase.from("areas").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Área excluída");
    qc.invalidateQueries({ queryKey: ["admin-sectors-full"] });
  }

  function toggle(id: string) {
    setExpanded((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  if (q.isLoading) return <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button className={btnPrimary} onClick={() => setEditSector({ sort_order: (q.data?.length ?? 0) + 1 })}>
          <Plus className="w-4 h-4" /> Novo setor
        </button>
      </div>

      {q.data!.map((s) => {
        const open = expanded.has(s.id);
        return (
          <div key={s.id} className="card-elevated p-3">
            <div className="flex items-center gap-2">
              <button onClick={() => toggle(s.id)} className="p-1 hover:bg-muted rounded">
                {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{s.name}</div>
                <div className="text-xs text-muted-foreground font-mono">{s.slug} · Ordem {s.sort_order}</div>
              </div>
              <button className={btnGhost} onClick={() => setEditSector(s)}><Pencil className="w-4 h-4" /></button>
              <button className={btnDanger} onClick={() => deleteSector(s.id)}><Trash2 className="w-4 h-4" /></button>
            </div>

            {open && (
              <div className="mt-3 pl-8 space-y-2">
                {s.areas.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/40">
                    <div className="flex-1">
                      <div className="text-sm font-medium">{a.name}</div>
                      <div className="text-xs text-muted-foreground">Ordem {a.sort_order}</div>
                    </div>
                    <button className={btnGhost} onClick={() => setEditArea(a)}><Pencil className="w-4 h-4" /></button>
                    <button className={btnDanger} onClick={() => deleteArea(a.id)}><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
                <button
                  className={btnGhost}
                  onClick={() => setEditArea({ sector_id: s.id, sort_order: (s.areas.length ?? 0) + 1 })}
                >
                  <Plus className="w-4 h-4" /> Nova área
                </button>
              </div>
            )}
          </div>
        );
      })}
      {q.data!.length === 0 && (
        <div className="card-elevated p-8 text-center text-sm text-muted-foreground">Nenhum setor cadastrado.</div>
      )}

      <SectorForm value={editSector} onClose={() => setEditSector(null)} />
      <AreaForm value={editArea} onClose={() => setEditArea(null)} />
    </div>
  );
}

function SectorForm({ value, onClose }: { value: Partial<SectorRow> | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(value?.name ?? "");
  const [slug, setSlug] = useState(value?.slug ?? "");
  const [sortOrder, setSortOrder] = useState<number>(value?.sort_order ?? 1);
  const [saving, setSaving] = useState(false);

  // Sync when opening
  useStateSync(value, (v) => {
    setName(v?.name ?? "");
    setSlug(v?.slug ?? "");
    setSortOrder(v?.sort_order ?? 1);
  });

  async function save() {
    if (!name.trim()) return toast.error("Informe o nome");
    setSaving(true);
    const payload = { name: name.trim(), slug: (slug.trim() || slugify(name)), sort_order: sortOrder };
    const res = value?.id
      ? await supabase.from("sectors").update(payload).eq("id", value.id)
      : await supabase.from("sectors").insert(payload);
    setSaving(false);
    if (res.error) return toast.error(res.error.message);
    toast.success("Setor salvo");
    qc.invalidateQueries({ queryKey: ["admin-sectors-full"] });
    onClose();
  }

  return (
    <Modal open={!!value} onClose={onClose} title={value?.id ? "Editar setor" : "Novo setor"}>
      <div className="space-y-3">
        <Field label="Nome"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} onBlur={() => !slug && setSlug(slugify(name))} /></Field>
        <Field label="Slug"><input className={inputCls} value={slug} onChange={(e) => setSlug(slugify(e.target.value))} placeholder="ex: cozinha" /></Field>
        <Field label="Ordem de exibição"><input type="number" className={inputCls} value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value) || 0)} /></Field>
        <div className="flex justify-end gap-2 pt-2">
          <button className={btnGhost} onClick={onClose}>Cancelar</button>
          <button className={btnPrimary} onClick={save} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Salvar
          </button>
        </div>
      </div>
    </Modal>
  );
}

function AreaForm({ value, onClose }: { value: (Partial<AreaRow> & { sector_id: string }) | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(value?.name ?? "");
  const [sortOrder, setSortOrder] = useState<number>(value?.sort_order ?? 1);
  const [saving, setSaving] = useState(false);

  useStateSync(value, (v) => {
    setName(v?.name ?? "");
    setSortOrder(v?.sort_order ?? 1);
  });

  async function save() {
    if (!value) return;
    if (!name.trim()) return toast.error("Informe o nome");
    setSaving(true);
    const payload = { name: name.trim(), sort_order: sortOrder, sector_id: value.sector_id };
    const res = value.id
      ? await supabase.from("areas").update(payload).eq("id", value.id)
      : await supabase.from("areas").insert(payload);
    setSaving(false);
    if (res.error) return toast.error(res.error.message);
    toast.success("Área salva");
    qc.invalidateQueries({ queryKey: ["admin-sectors-full"] });
    onClose();
  }

  return (
    <Modal open={!!value} onClose={onClose} title={value?.id ? "Editar área" : "Nova área"}>
      <div className="space-y-3">
        <Field label="Nome"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Ordem de exibição"><input type="number" className={inputCls} value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value) || 0)} /></Field>
        <div className="flex justify-end gap-2 pt-2">
          <button className={btnGhost} onClick={onClose}>Cancelar</button>
          <button className={btnPrimary} onClick={save} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Salvar
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* Helper hook: reset form state when the incoming value changes */

function useStateSync<T>(value: T, apply: (v: T) => void) {
  const ref = useRef(value);
  useEffect(() => {
    if (ref.current !== value) {
      ref.current = value;
      apply(value);
    }
  }, [value, apply]);
}

/* ---------- Templates & Items ---------- */
type TemplateRow = {
  id: string; sector_id: string | null; name: string; slug: string;
  description: string | null; kind: ChecklistKind; is_active: boolean; sort_order: number;
  schedule_days: number[] | null;
};
type ItemRow = {
  id: string; template_id: string; position: number; title: string;
  guidance: string | null; priority: ItemPriority; is_critical: boolean;
  weight: number; requires_photo_on_conforme: boolean;
  is_required: boolean; allow_not_applicable: boolean;
  has_goal: boolean; goal_value: string | null;
  evidence_hints: string[];
};

function TemplatesTab() {
  const qc = useQueryClient();
  const [editTemplate, setEditTemplate] = useState<Partial<TemplateRow> | null>(null);
  const [manageItemsOf, setManageItemsOf] = useState<TemplateRow | null>(null);

  const q = useQuery({
    queryKey: ["admin-templates-full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_templates")
        .select("id, sector_id, name, slug, description, kind, is_active, sort_order, schedule_days, sector:sectors(name), checklist_items(id)")
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  async function del(id: string) {
    if (!confirm("Excluir este checklist e todos os seus itens?")) return;
    const { error } = await supabase.from("checklist_templates").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Checklist excluído");
    qc.invalidateQueries({ queryKey: ["admin-templates-full"] });
  }

  async function toggleActive(id: string, next: boolean) {
    const { error } = await supabase.from("checklist_templates").update({ is_active: next }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(next ? "Checklist ativado" : "Checklist desativado");
    qc.invalidateQueries({ queryKey: ["admin-templates-full"] });
  }

  async function duplicateTemplate(template: TemplateRow) {
    const copyName = `Cópia de ${template.name}`;
    const { data: newTemplate, error } = await supabase
      .from("checklist_templates")
      .insert({
        name: copyName,
        slug: copySlug(copyName),
        description: template.description,
        sector_id: template.sector_id,
        kind: template.kind,
        is_active: false,
        sort_order: (q.data?.length ?? 0) + 1,
        schedule_days: template.schedule_days ?? [],
      })
      .select("id, sector_id, name, slug, description, kind, is_active, sort_order, schedule_days")
      .single();
    if (error) return toast.error(error.message);

    const { data: items, error: itemsError } = await supabase
      .from("checklist_items")
      .select("position, title, guidance, priority, is_critical, weight, requires_photo_on_conforme, is_required, allow_not_applicable, has_goal, goal_value, evidence_hints")
      .eq("template_id", template.id)
      .order("position");
    if (itemsError) {
      qc.invalidateQueries({ queryKey: ["admin-templates-full"] });
      return toast.error(`Checklist criado, mas não consegui copiar os itens: ${itemsError.message}`);
    }

    if (items?.length) {
      const { error: copyItemsError } = await supabase.from("checklist_items").insert(
        items.map((item, index) => ({
          template_id: newTemplate.id,
          title: item.title,
          guidance: item.guidance,
          priority: item.priority,
          is_critical: item.is_critical,
          weight: item.weight,
          requires_photo_on_conforme: item.requires_photo_on_conforme,
          is_required: item.is_required,
          allow_not_applicable: item.allow_not_applicable,
          has_goal: item.has_goal,
          goal_value: item.goal_value,
          evidence_hints: item.evidence_hints ?? [],
          position: index + 1,
        })),
      );
      if (copyItemsError) {
        qc.invalidateQueries({ queryKey: ["admin-templates-full"] });
        return toast.error(`Checklist criado, mas não consegui copiar os itens: ${copyItemsError.message}`);
      }
    }

    toast.success("Checklist duplicado. A cópia foi criada inativa para revisão.");
    qc.invalidateQueries({ queryKey: ["admin-templates-full"] });
    setEditTemplate(newTemplate as TemplateRow);
  }

  async function persistTemplateOrder(next: any[]) {
    qc.setQueryData(["admin-templates-full"], next.map((t, i) => ({ ...t, sort_order: i + 1 })));
    const results = await Promise.all(
      next.map((t, i) => supabase.from("checklist_templates").update({ sort_order: i + 1 }).eq("id", t.id)),
    );
    const err = results.find((r) => r.error)?.error;
    if (err) {
      toast.error(err.message);
      qc.invalidateQueries({ queryKey: ["admin-templates-full"] });
    }
  }

  if (q.isLoading) return <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button className={btnPrimary} onClick={() => setEditTemplate({ kind: "operacional", is_active: true, sort_order: (q.data?.length ?? 0) + 1 })}>
          <Plus className="w-4 h-4" /> Novo checklist
        </button>
      </div>

      {q.data!.length > 0 && (
        <SortableList
          items={q.data as any[]}
          onReorder={persistTemplateOrder}
          renderItem={(t: any, handle) => (
            <div className="card-elevated p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  {handle}
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{t.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {t.sector?.name ?? "Sem setor"} · {t.kind} · {t.checklist_items?.length ?? 0} itens
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => toggleActive(t.id, !t.is_active)}
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full transition-colors ${t.is_active ? "bg-success/20 text-success hover:bg-success/30" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}
                  title={t.is_active ? "Clique para desativar" : "Clique para ativar"}
                >
                  {t.is_active ? "Ativo" : "Inativo"}
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className={btnGhost} onClick={() => setManageItemsOf(t)}><ClipboardList className="w-4 h-4" /> Itens</button>
                <button className={btnGhost} onClick={() => duplicateTemplate(t)}><Copy className="w-4 h-4" /> Duplicar</button>
                <button className={btnGhost} onClick={() => setEditTemplate(t)}><Pencil className="w-4 h-4" /> Editar</button>
                <button className={btnGhost} onClick={() => toggleActive(t.id, !t.is_active)}>
                  {t.is_active ? "Desativar" : "Ativar"}
                </button>
                <button className={btnDanger} onClick={() => del(t.id)}><Trash2 className="w-4 h-4" /> Excluir</button>
              </div>
            </div>
          )}
        />
      )}
      {q.data!.length === 0 && (
        <div className="card-elevated p-8 text-center text-sm text-muted-foreground">Nenhum checklist cadastrado.</div>
      )}

      <TemplateForm value={editTemplate} onClose={() => setEditTemplate(null)} />
      {manageItemsOf && <ItemsModal template={manageItemsOf} onClose={() => setManageItemsOf(null)} />}
    </div>
  );
}

function TemplateForm({ value, onClose }: { value: Partial<TemplateRow> | null; onClose: () => void }) {
  const qc = useQueryClient();
  const sectors = useQuery({
    queryKey: ["admin-sectors-list"],
    queryFn: async () => (await supabase.from("sectors").select("id, name").order("sort_order")).data ?? [],
  });

  const [name, setName] = useState(value?.name ?? "");
  const [slug, setSlug] = useState(value?.slug ?? "");
  const [description, setDescription] = useState(value?.description ?? "");
  const [sectorId, setSectorId] = useState<string>(value?.sector_id ?? "");
  const [kind, setKind] = useState<ChecklistKind>(value?.kind ?? "operacional");
  const [isActive, setIsActive] = useState<boolean>(value?.is_active ?? true);
  const [sortOrder, setSortOrder] = useState<number>(value?.sort_order ?? 1);
  const [scheduleDays, setScheduleDays] = useState<number[]>(value?.schedule_days ?? []);
  const [saving, setSaving] = useState(false);

  useStateSync(value, (v) => {
    setName(v?.name ?? "");
    setSlug(v?.slug ?? "");
    setDescription(v?.description ?? "");
    setSectorId(v?.sector_id ?? "");
    setKind(v?.kind ?? "operacional");
    setIsActive(v?.is_active ?? true);
    setSortOrder(v?.sort_order ?? 1);
    setScheduleDays(v?.schedule_days ?? []);
  });

  async function save() {
    if (!name.trim()) return toast.error("Informe o nome");
    setSaving(true);
    const payload = {
      name: name.trim(),
      slug: (slug.trim() || slugify(name)),
      description: description?.trim() || null,
      sector_id: sectorId || null,
      kind, is_active: isActive, sort_order: sortOrder,
      schedule_days: [...scheduleDays].sort((a, b) => a - b),
    };
    const res = value?.id
      ? await supabase.from("checklist_templates").update(payload).eq("id", value.id)
      : await supabase.from("checklist_templates").insert(payload);
    setSaving(false);
    if (res.error) return toast.error(res.error.message);
    toast.success("Checklist salvo");
    qc.invalidateQueries({ queryKey: ["admin-templates-full"] });
    onClose();
  }

  return (
    <Modal open={!!value} onClose={onClose} title={value?.id ? "Editar checklist" : "Novo checklist"}>
      <div className="space-y-3">
        <Field label="Nome"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} onBlur={() => !slug && setSlug(slugify(name))} /></Field>
        <Field label="Slug (URL)"><input className={inputCls} value={slug} onChange={(e) => setSlug(slugify(e.target.value))} placeholder="ex: cozinha-abertura" /></Field>
        <Field label="Descrição">
          <textarea className={`${inputCls} h-20 py-2`} value={description ?? ""} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Setor">
            <select className={inputCls} value={sectorId} onChange={(e) => setSectorId(e.target.value)}>
              <option value="">— Sem setor —</option>
              {sectors.data?.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Tipo">
            <select className={inputCls} value={kind} onChange={(e) => setKind(e.target.value as ChecklistKind)}>
              {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ordem"><input type="number" className={inputCls} value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value) || 0)} /></Field>
          <label className="flex items-end gap-2 pb-2">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4" />
            <span className="text-sm">Ativo</span>
          </label>
        </div>
        <Field label="Dias em que é obrigatório">
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((d) => {
              const on = scheduleDays.includes(d.value);
              return (
                <button
                  key={d.value}
                  type="button"
                  onClick={() =>
                    setScheduleDays((prev) =>
                      prev.includes(d.value) ? prev.filter((x) => x !== d.value) : [...prev, d.value],
                    )
                  }
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${on ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-muted"}`}
                >
                  {d.short}
                </button>
              );
            })}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Deixe todos desmarcados para cobrar em <strong>todos os dias</strong>.
          </div>
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button className={btnGhost} onClick={onClose}>Cancelar</button>
          <button className={btnPrimary} onClick={save} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Salvar
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ItemsModal({ template, onClose }: { template: TemplateRow; onClose: () => void }) {
  const qc = useQueryClient();
  const [editItem, setEditItem] = useState<Partial<ItemRow> | null>(null);
  const q = useQuery({
    queryKey: ["admin-items", template.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_items")
        .select("id, template_id, position, title, guidance, priority, is_critical, weight, requires_photo_on_conforme, is_required, allow_not_applicable, has_goal, goal_value, evidence_hints")
        .eq("template_id", template.id)
        .order("position");
      if (error) throw error;
      return (data ?? []) as ItemRow[];
    },
  });

  async function del(id: string) {
    if (!confirm("Excluir este item?")) return;
    const { error } = await supabase.from("checklist_items").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Item excluído");
    qc.invalidateQueries({ queryKey: ["admin-items", template.id] });
    qc.invalidateQueries({ queryKey: ["admin-templates-full"] });
  }

  async function persistOrder(next: ItemRow[]) {
    qc.setQueryData(["admin-items", template.id], next.map((it, i) => ({ ...it, position: i + 1 })));
    const updates = next.map((it, i) =>
      supabase.from("checklist_items").update({ position: i + 1 }).eq("id", it.id),
    );
    const results = await Promise.all(updates);
    const err = results.find((r) => r.error)?.error;
    if (err) {
      toast.error(err.message);
      qc.invalidateQueries({ queryKey: ["admin-items", template.id] });
    }
  }

  return (
    <Modal open onClose={onClose} title={`Itens — ${template.name}`}>
      <div className="space-y-3">
        <div className="flex justify-end">
          <button
            className={btnPrimary}
            onClick={() => setEditItem({
              template_id: template.id,
              position: (q.data?.length ?? 0) + 1,
              priority: "medio",
              is_critical: false,
              weight: 1,
              requires_photo_on_conforme: false,
              is_required: true,
              allow_not_applicable: false,
              has_goal: false,
              goal_value: null,
              evidence_hints: [],
            })}
          >
            <Plus className="w-4 h-4" /> Novo item
          </button>
        </div>

        {q.isLoading ? (
          <div className="p-6 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>
        ) : q.data!.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Nenhum item cadastrado.</div>
        ) : (
          <SortableList
            items={q.data!}
            onReorder={persistOrder}
            renderItem={(it, handle) => (
              <div className="p-3 rounded-md border border-border bg-card">
                <div className="flex items-start gap-2">
                  {handle}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{it.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-2">
                      <span>{PRIORITY_LABEL[it.priority]}</span>
                      {it.is_critical && <span className="text-destructive font-medium">Crítico</span>}
                      {it.requires_photo_on_conforme && <span>Foto obrigatória</span>}
                    </div>
                  </div>
                  <button className={btnGhost} onClick={() => setEditItem(it)}><Pencil className="w-4 h-4" /></button>
                  <button className={btnDanger} onClick={() => del(it.id)}><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            )}
          />
        )}

        <ItemForm value={editItem} templateId={template.id} onClose={() => setEditItem(null)} />
      </div>
    </Modal>
  );
}

function ItemForm({ value, templateId, onClose }: { value: Partial<ItemRow> | null; templateId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(value?.title ?? "");
  const [guidance, setGuidance] = useState(value?.guidance ?? "");
  const [position, setPosition] = useState<number>(value?.position ?? 1);
  const [priority, setPriority] = useState<ItemPriority>(value?.priority ?? "medio");
  const [isCritical, setIsCritical] = useState<boolean>(value?.is_critical ?? false);
  const [weight, setWeight] = useState<number>(value?.weight ?? 1);
  const [reqPhoto, setReqPhoto] = useState<boolean>(value?.requires_photo_on_conforme ?? false);
  const [isRequired, setIsRequired] = useState<boolean>(value?.is_required ?? true);
  const [allowNA, setAllowNA] = useState<boolean>(value?.allow_not_applicable ?? false);
  const [hasGoal, setHasGoal] = useState<boolean>(value?.has_goal ?? false);
  const [goalValue, setGoalValue] = useState<string>(value?.goal_value ?? "");
  const [evidences, setEvidences] = useState<string[]>(value?.evidence_hints ?? []);
  const [newEvidence, setNewEvidence] = useState("");
  const [saving, setSaving] = useState(false);

  useStateSync(value, (v) => {
    setTitle(v?.title ?? "");
    setGuidance(v?.guidance ?? "");
    setPosition(v?.position ?? 1);
    setPriority(v?.priority ?? "medio");
    setIsCritical(v?.is_critical ?? false);
    setWeight(v?.weight ?? 1);
    setReqPhoto(v?.requires_photo_on_conforme ?? false);
    setIsRequired(v?.is_required ?? true);
    setAllowNA(v?.allow_not_applicable ?? false);
    setHasGoal(v?.has_goal ?? false);
    setGoalValue(v?.goal_value ?? "");
    setEvidences(v?.evidence_hints ?? []);
    setNewEvidence("");
  });

  function addEvidence() {
    const v = newEvidence.trim();
    if (!v) return;
    setEvidences((prev) => [...prev, v]);
    setNewEvidence("");
  }
  function removeEvidence(i: number) {
    setEvidences((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function save() {
    if (!value) return;
    if (!title.trim()) return toast.error("Informe o título");
    setSaving(true);
    const payload = {
      template_id: templateId,
      title: title.trim(),
      guidance: guidance?.trim() || null,
      position, priority,
      is_critical: isCritical || priority === "critico",
      weight, requires_photo_on_conforme: reqPhoto,
      is_required: isRequired,
      allow_not_applicable: allowNA,
      has_goal: hasGoal,
      goal_value: hasGoal ? (goalValue.trim() || null) : null,
      evidence_hints: evidences,
    };
    const res = value.id
      ? await supabase.from("checklist_items").update(payload).eq("id", value.id)
      : await supabase.from("checklist_items").insert(payload);
    setSaving(false);
    if (res.error) return toast.error(res.error.message);
    toast.success("Item salvo");
    qc.invalidateQueries({ queryKey: ["admin-items", templateId] });
    qc.invalidateQueries({ queryKey: ["admin-templates-full"] });
    onClose();
  }

  return (
    <Modal open={!!value} onClose={onClose} title={value?.id ? "Editar item" : "Novo item"}>
      <div className="space-y-4">
        <Field label="Título do item"><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Limpar chão e bancada" /></Field>
        <Field label="Descrição da atividade">
          <textarea className={`${inputCls} h-24 py-2`} value={guidance ?? ""} onChange={(e) => setGuidance(e.target.value)} placeholder="Descreva o que deve ser feito neste item…" />
        </Field>
        <div className="grid grid-cols-1 gap-3">
          <Field label="Prioridade">
            <select className={inputCls} value={priority} onChange={(e) => setPriority(e.target.value as ItemPriority)}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
            </select>
          </Field>
        </div>

        {/* Evidências */}
        <div className="space-y-2">
          <div className="text-sm font-semibold">Evidências</div>
          <div className="text-xs text-muted-foreground">Liste as evidências esperadas para este item (fotos, documentos, etc.).</div>
          {evidences.length > 0 && (
            <div className="space-y-1">
              {evidences.map((ev, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-md bg-muted/40 text-sm">
                  <span className="flex-1">{ev}</span>
                  <button type="button" onClick={() => removeEvidence(i)} className="text-destructive hover:bg-destructive/10 p-1 rounded"><X className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              className={inputCls}
              value={newEvidence}
              onChange={(e) => setNewEvidence(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addEvidence(); } }}
              placeholder="Ex: foto da bancada limpa"
            />
            <button type="button" className={btnGhost} onClick={addEvidence}><Plus className="w-4 h-4" /></button>
          </div>
        </div>

        {/* Recursos adicionais */}
        <div className="space-y-2">
          <div className="text-sm font-semibold">Recursos adicionais</div>
          <div className="grid grid-cols-2 gap-2">
            <ToggleChip active={isRequired} onClick={() => setIsRequired((v) => !v)} label="Obrigatório" />
            <ToggleChip active={isCritical} onClick={() => setIsCritical((v) => !v)} label="Item crítico" />
            <ToggleChip active={hasGoal} onClick={() => setHasGoal((v) => !v)} label="Definir meta" />
            <ToggleChip active={allowNA} onClick={() => setAllowNA((v) => !v)} label="Permitir Não se aplica" />
            <ToggleChip active={reqPhoto} onClick={() => setReqPhoto((v) => !v)} label="Foto obrigatória" />
          </div>
          {hasGoal && (
            <Field label="Meta">
              <input className={inputCls} value={goalValue} onChange={(e) => setGoalValue(e.target.value)} placeholder="Ex: 100% dos itens, até 10:30h, etc." />
            </Field>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button className={btnGhost} onClick={onClose}>Cancelar</button>
          <button className={btnPrimary} onClick={save} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Salvar
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ToggleChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 h-10 px-3 rounded-lg border-2 text-sm font-medium transition-colors ${
        active ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"
      }`}
    >
      <span className={`w-4 h-4 rounded grid place-items-center text-xs ${active ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
        {active ? "✓" : ""}
      </span>
      {label}
    </button>
  );
}
