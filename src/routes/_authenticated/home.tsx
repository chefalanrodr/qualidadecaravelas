import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ListChecks, ShieldCheck, AlertTriangle, FileText, Settings, Play, Loader2, ChevronRight, LayoutDashboard } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { isoWeek, weekOfMonth } from "@/lib/quality";
import { HomeMiniStats } from "@/components/HomeMiniStats";
import { usePerfil } from "@/lib/perfil";


export const Route = createFileRoute("/_authenticated/home")({
  component: HomePage,
});

function HomePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const now = new Date();
  const { isAdmin, canRunChecklist, canRunQualityAudit, canViewReports, canViewActionPlans } = usePerfil();

  const restaurantQ = useQuery({
    queryKey: ["home-restaurant"],
    queryFn: async () => {
      const { data } = await supabase
        .from("restaurant_settings")
        .select("name, logo_url, greeting")
        .eq("id", 1)
        .maybeSingle();
      return data ?? { name: "Meu Restaurante", logo_url: null, greeting: null };
    },
  });

  const openAuditsQ = useQuery({
    queryKey: ["home-open-audits"],
    enabled: canRunQualityAudit,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quality_audits")
        .select("id, iso_week, iso_year, started_at")
        .eq("status", "em_andamento")
        .order("started_at", { ascending: false })
        .limit(3);
      if (error) throw error;
      return data ?? [];
    },
  });

  const createAuditMut = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Sem usuário");
      const iw = isoWeek(now);
      const { data, error } = await supabase.from("quality_audits").insert({
        auditor_id: userData.user.id,
        iso_year: iw.year, iso_week: iw.week,
        month: now.getMonth() + 1, year: now.getFullYear(),
        week_of_month: weekOfMonth(now),
        status: "em_andamento",
      }).select("id").single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      qc.invalidateQueries();
      navigate({ to: "/quality/audit/$id", params: { id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const shortcuts = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, color: "bg-primary/10 text-primary", show: true },
    { to: "/action-plans", label: "Planos de ação", icon: AlertTriangle, color: "bg-warning/15 text-warning", show: canViewActionPlans },
    { to: "/reports", label: "Relatórios", icon: FileText, color: "bg-accent text-accent-foreground", show: canViewReports },
    { to: "/admin", label: "Administração", icon: Settings, color: "bg-muted text-foreground", show: isAdmin },
  ] as const;

  return (
    <div className="space-y-8">
      <section className="p-1 sm:p-2 flex items-start gap-4">
        {restaurantQ.data?.logo_url && (
          <img
            src={restaurantQ.data.logo_url}
            alt={restaurantQ.data.name}
            className="w-16 h-16 rounded-2xl object-cover shrink-0 bg-white shadow-sm"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground break-words">
            {format(now, "EEEE, dd 'de' MMMM", { locale: ptBR })} · {restaurantQ.data?.name ?? ""}
          </div>
          <h1 className="mt-1.5 text-xl sm:text-2xl font-bold leading-tight break-words text-foreground">
            {(() => {
              const g = restaurantQ.data?.greeting?.trim() || "Olá, tudo pronto para o turno?";
              const m = g.match(/^(\S+)(\s[\s\S]*)?$/);
              if (!m) return g;
              return (<><span className="text-primary">{m[1]}</span><span>{m[2] ?? ""}</span></>);
            })()}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">O que você quer fazer agora?</p>
        </div>
      </section>

      {/* Mini dashboard */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Resumo</h2>
          <Link to="/dashboard" className="text-xs font-semibold text-primary hover:underline">Ver dashboard →</Link>
        </div>
        <HomeMiniStats />
      </section>






      {/* Big action buttons */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Ações rápidas</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {canRunChecklist && (
            <Link
              to="/checklists"
              className="card-elevated p-3 hover:shadow-lg transition-shadow flex items-center gap-3"
            >
              <div className="shrink-0 w-10 h-10 rounded-xl bg-primary/15 text-primary grid place-items-center">
                <ListChecks className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-sm">Novo checklist</div>
                <div className="text-xs text-muted-foreground truncate">Abertura, encerramento e mais</div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </Link>
          )}

          {canRunQualityAudit && (
            <button
              type="button"
              onClick={() => createAuditMut.mutate()}
              disabled={createAuditMut.isPending}
              className="card-elevated p-3 hover:shadow-lg transition-shadow flex items-center gap-3 text-left disabled:opacity-60"
            >
              <div className="shrink-0 w-10 h-10 rounded-xl brand-gradient grid place-items-center">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-sm">Nova auditoria</div>
                <div className="text-xs text-muted-foreground truncate">Semanal por setor e área</div>
              </div>
              {createAuditMut.isPending ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
            </button>
          )}
        </div>
      </section>




      {/* Open audits */}
      {canRunQualityAudit && (openAuditsQ.data ?? []).length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Auditorias em andamento</h2>
          <div className="grid gap-2">
            {openAuditsQ.data!.map((a) => (
              <Link key={a.id} to="/quality/audit/$id" params={{ id: a.id }} className="card-elevated p-4 flex items-center gap-3 hover:shadow-lg">
                <div className="w-10 h-10 rounded-xl brand-gradient grid place-items-center"><Play className="w-5 h-5 text-white" /></div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">Semana {a.iso_week}/{a.iso_year}</div>
                  <div className="text-xs text-muted-foreground">Iniciada em {format(new Date(a.started_at), "dd/MM 'às' HH:mm", { locale: ptBR })}</div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Shortcuts */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Atalhos</h2>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
          {shortcuts.filter((m) => m.show).map((m) => (
            <Link key={m.to} to={m.to} className="card-elevated p-4 hover:shadow-lg transition-shadow flex flex-col items-start gap-3 min-h-[110px]">
              <div className={`w-10 h-10 rounded-xl grid place-items-center ${m.color}`}>
                <m.icon className="w-5 h-5" />
              </div>
              <div className="text-sm font-semibold leading-tight">{m.label}</div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
