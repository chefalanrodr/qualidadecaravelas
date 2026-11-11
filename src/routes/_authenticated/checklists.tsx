import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChevronRight, Play, ChefHat, FolderOpen, Calendar } from "lucide-react";
import { useMemo, useState } from "react";
import { isScheduledFor, describeSchedule } from "@/lib/schedule";
import { RequirePerfil } from "@/components/RequirePerfil";

export const Route = createFileRoute("/_authenticated/checklists")({
  component: () => <RequirePerfil allow={["operador", "gestor", "auditor"]}><ChecklistsPage /></RequirePerfil>,
});

type Template = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  schedule_days: number[] | null;
  sector: { id: string; name: string } | null;
  items: Array<{ id: string }> | null;
};

function ChecklistsPage() {
  const [openSector, setOpenSector] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["op-templates"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_templates")
        .select("id, name, slug, description, kind, schedule_days, sector:sectors(id, name), items:checklist_items(id)")
        .eq("is_active", true)
        .eq("kind", "operacional")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as unknown as Template[];
    },
  });

  const grouped = useMemo(() => {
    const map = new Map<string, { id: string; name: string; templates: Template[] }>();
    (q.data ?? []).forEach((t) => {
      const key = t.sector?.id ?? "sem-setor";
      const name = t.sector?.name ?? "Sem setor";
      const g = map.get(key) ?? { id: key, name, templates: [] };
      g.templates.push(t);
      map.set(key, g);
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [q.data]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Checklists Operacionais</h1>
        <p className="text-sm text-muted-foreground">Escolha o setor para ver as rotinas disponíveis.</p>
      </div>

      {grouped.length === 0 ? (
        <div className="card-elevated p-8 text-sm text-muted-foreground text-center">
          Nenhum checklist operacional cadastrado.
        </div>
      ) : (
        <div className="grid gap-3">
          {grouped.map((g) => {
            const isOpen = openSector === g.id;
            const totalItems = g.templates.reduce((s, t) => s + (t.items?.length ?? 0), 0);
            return (
              <div key={g.id} className="card-elevated overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenSector(isOpen ? null : g.id)}
                  className="w-full flex items-center gap-4 p-5 text-left hover:bg-muted/40 transition-colors"
                  aria-expanded={isOpen}
                >
                  <div className="shrink-0 w-11 h-11 rounded-xl brand-gradient grid place-items-center">
                    <ChefHat className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold capitalize">{g.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {g.templates.length} {g.templates.length === 1 ? "checklist" : "checklists"} · {totalItems} itens
                    </div>
                  </div>
                  <ChevronRight
                    className={`w-5 h-5 text-muted-foreground shrink-0 transition-transform duration-300 ${isOpen ? "rotate-90" : ""}`}
                  />
                </button>

                {isOpen && (
                  <div className="border-t border-border bg-muted/20 p-3 space-y-2 animate-fade-in">
                    {g.templates.length === 0 ? (
                      <div className="text-sm text-muted-foreground text-center py-4 flex items-center justify-center gap-2">
                        <FolderOpen className="w-4 h-4" /> Nenhum checklist neste setor.
                      </div>
                    ) : (
                      g.templates.map((t) => {
                        const forToday = isScheduledFor(t.schedule_days);
                        return (
                          <Link
                            key={t.id}
                            to="/checklist/$slug"
                            params={{ slug: t.slug }}
                            className={`bg-card border rounded-xl p-4 flex items-start gap-3 hover:shadow-md hover:border-primary/30 transition-all group ${forToday ? "border-primary/40" : "border-border opacity-70"}`}
                          >
                            <div className="shrink-0 w-9 h-9 rounded-lg bg-primary/10 text-primary grid place-items-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                              <Play className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-sm">{t.name}</span>
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-1 ${forToday ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                                  <Calendar className="w-2.5 h-2.5" />
                                  {forToday ? "Hoje" : describeSchedule(t.schedule_days)}
                                </span>
                              </div>
                              <div className="text-xs text-muted-foreground">{t.items?.length ?? 0} itens · {describeSchedule(t.schedule_days)}</div>
                              {t.description && (
                                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{t.description}</p>
                              )}
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                          </Link>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
