import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Menu, X, Home, ListChecks, AlertTriangle, BarChart3, FileText, Settings, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { usePerfil, PERFIL_LABEL } from "@/lib/perfil";

export function AppShell({ children }: { children: ReactNode }) {
  const [email, setEmail] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
      const meta = data.user?.user_metadata as { full_name?: string } | undefined;
      setName(meta?.full_name ?? data.user?.email?.split("@")[0] ?? null);
    });
  }, []);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    router.invalidate();
    navigate({ to: "/auth", replace: true });
  }

  const { perfil, isAdmin, canRunChecklist, canRunQualityAudit, canConfigureQuality, canViewReports, canViewActionPlans, canViewDashboard } = usePerfil();
  const allNav = [
    { to: "/home", label: "Início", icon: Home, show: true },
    { to: "/checklists", label: "Checklists", icon: ListChecks, show: canRunChecklist },
    { to: "/quality", label: "Auditoria de Qualidade", icon: ShieldCheck, show: canRunQualityAudit || canConfigureQuality },
    { to: "/action-plans", label: "Planos de ação", icon: AlertTriangle, show: canViewActionPlans },
    { to: "/reports", label: "Relatórios", icon: FileText, show: canViewReports },
    { to: "/dashboard", label: "Dashboard", icon: BarChart3, show: canViewDashboard },
    { to: "/settings", label: "Configurações", icon: SlidersHorizontal, show: true },
    { to: "/admin", label: "Administração", icon: Settings, show: isAdmin },
  ];
  const nav = allNav.filter((n) => n.show);

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(180deg, oklch(1 0 0) 0%, color-mix(in oklab, var(--color-primary) 14%, white) 100%)" }}>

      <header className="brand-gradient sticky top-0 z-30 shadow-md text-white">
        <div className="mx-auto max-w-6xl px-3 sm:px-4 py-2.5 flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            className="lg:hidden shrink-0 rounded-lg p-2 hover:bg-white/10"
            onClick={() => setOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <Link to="/home" className="flex items-center gap-2 min-w-0 flex-1">
            <div className="shrink-0 w-9 h-9 rounded-xl bg-card grid place-items-center overflow-hidden p-1">
              <img src="/confere-ai-logo.png" alt="Confere Aí" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0 hidden sm:block">
              <div className="text-sm font-bold leading-tight truncate">Confere Aí</div>
              <div className="text-[11px] text-white/70 leading-tight truncate">Auditoria de Restaurante</div>
            </div>
          </Link>

          <div className="flex items-center gap-2 min-w-0">
            <div className="hidden md:flex flex-col items-end min-w-0 max-w-[240px] leading-tight">
              <div className="flex items-center gap-1.5 min-w-0 max-w-full">
                {perfil && (
                  <span className="shrink-0 px-1.5 py-0.5 rounded bg-white/20 text-[10px] font-semibold uppercase tracking-wide">
                    {PERFIL_LABEL[perfil]}
                  </span>
                )}
                <span className="text-xs font-semibold truncate">{name}</span>
              </div>
              {email && <div className="text-[10px] text-white/70 truncate max-w-full mt-0.5">{email}</div>}
            </div>
            {perfil && (
              <span className="md:hidden shrink-0 px-1.5 py-0.5 rounded bg-white/20 text-[10px] font-semibold uppercase tracking-wide">
                {PERFIL_LABEL[perfil]}
              </span>
            )}
            <button onClick={signOut} className="shrink-0 rounded-lg p-2 hover:bg-white/10" title="Sair" aria-label="Sair">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-6">
        <aside className="hidden lg:block">
          <nav className="card-elevated p-2 sticky top-24">
            {nav.map((it) => (
              <Link
                key={it.to}
                to={it.to}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted [&.active]:bg-accent [&.active]:text-accent-foreground"
                activeProps={{ className: "active" }}
              >
                <it.icon className="w-4 h-4 shrink-0" />
                {it.label}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="min-w-0">{children}</main>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 max-w-[85%] bg-card shadow-xl p-4 flex flex-col gap-2 animate-in slide-in-from-left">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">Menu</div>
              <button onClick={() => setOpen(false)} className="rounded-lg p-2 hover:bg-muted"><X className="w-5 h-5" /></button>
            </div>
            {nav.map((it) => (
              <Link
                key={it.to}
                to={it.to}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium hover:bg-muted [&.active]:bg-accent [&.active]:text-accent-foreground"
                activeProps={{ className: "active" }}
              >
                <it.icon className="w-4 h-4" />
                {it.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
