import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "gestor" | "auditor" | "operador";
export type Perfil = AppRole;

export const PERFIL_LABEL: Record<Perfil, string> = {
  admin: "Administrador",
  gestor: "Gestor",
  auditor: "Auditor de Qualidade",
  operador: "Operador",
};

export function useRoles() {
  return useQuery({
    queryKey: ["me-roles"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<AppRole[]> => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", u.user.id);
      if (error) return [];
      return (data ?? []).map((r) => r.role as AppRole);
    },
  });
}

export function usePerfil() {
  const q = useRoles();
  const roles = q.data ?? [];
  // Prioridade de exibição: admin > gestor > auditor > operador
  const perfil: Perfil | null = roles.includes("admin")
    ? "admin"
    : roles.includes("gestor")
      ? "gestor"
      : roles.includes("auditor")
        ? "auditor"
        : roles.includes("operador")
          ? "operador"
          : null;
  const has = (r: AppRole) => roles.includes(r);
  return {
    perfil,
    roles,
    isAdmin: has("admin"),
    isGestor: has("gestor") || has("admin"),
    isAuditor: has("auditor") || has("admin"),
    isOperador: has("operador") || has("admin"),
    // Permissões derivadas
    canConfigureChecklists: has("admin"),
    canConfigureQuality: has("admin") || has("gestor") || has("auditor"),
    canRunQualityAudit: has("admin") || has("gestor") || has("auditor"),
    canRunChecklist: has("admin") || has("gestor") || has("auditor") || has("operador"),
    canViewReports: has("admin") || has("gestor") || has("auditor"),
    canViewActionPlans: has("admin") || has("gestor") || has("auditor"),
    canViewDashboard: roles.length > 0,
    loading: q.isLoading,
  };
}
