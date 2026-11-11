import { type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Lock, Loader2 } from "lucide-react";
import { usePerfil, type Perfil } from "@/lib/perfil";

type Props = {
  allow: Perfil[]; // perfis que podem ver (admin passa em tudo)
  children: ReactNode;
};

export function RequirePerfil({ allow, children }: Props) {
  const { roles, loading, isAdmin } = usePerfil();

  if (loading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
      </div>
    );
  }

  const allowed = isAdmin || roles.some((role) => allow.includes(role));
  if (!allowed) {
    return (
      <div className="card-elevated p-8 text-center max-w-md mx-auto">
        <Lock className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
        <h2 className="text-lg font-bold mb-1">Acesso restrito</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Seu perfil não tem permissão para acessar esta área. Fale com um administrador.
        </p>
        <Link to="/home" className="inline-flex items-center justify-center rounded-md brand-gradient px-4 py-2 text-sm font-medium">
          Voltar ao início
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
