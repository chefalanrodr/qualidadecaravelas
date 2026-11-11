import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Entrar — Checklist Operacional" },
      { name: "description", content: "Acesse sua conta para preencher checklists operacionais e auditorias." },
    ],
  }),
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Enviamos um link de redefinição para seu e-mail.");
      setMode("login");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao enviar e-mail");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/home", replace: true });
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        // Se a confirmação de e-mail está ativada, não há sessão após signUp.
        if (!data.session) {
          toast.success("Conta criada! Enviamos um e-mail para você confirmar o cadastro. Confirme para poder entrar.");
          setMode("login");
          setPassword("");
          return;
        }
        toast.success("Conta criada! Entrando…");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/home", replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao autenticar";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto w-24 h-24 rounded-2xl bg-card shadow-lg grid place-items-center overflow-hidden p-2">
            <img src="/confere-ai-logo.png" alt="Confere Aí" className="w-full h-full object-contain" />
          </div>
          <h1 className="mt-4 text-2xl font-bold">Confere Aí</h1>
          <p className="text-sm text-muted-foreground">Auditoria e qualidade para restaurantes</p>
        </div>

        <div className="card-elevated p-6">
          {mode !== "forgot" && (
            <div className="flex gap-2 mb-6 bg-muted p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setMode("login")}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition ${mode === "login" ? "bg-card shadow-sm" : "text-muted-foreground"}`}
              >Entrar</button>
              <button
                type="button"
                onClick={() => setMode("signup")}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition ${mode === "signup" ? "bg-card shadow-sm" : "text-muted-foreground"}`}
              >Criar conta</button>
            </div>
          )}

          {mode === "forgot" ? (
            <form onSubmit={handleForgot} className="space-y-4">
              <div>
                <h2 className="font-display text-lg font-bold">Redefinir senha</h2>
                <p className="text-xs text-muted-foreground">Informe seu e-mail para receber o link.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email-f">E-mail</Label>
                <Input id="email-f" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-11" />
              </div>
              <Button type="submit" disabled={loading} className="w-full h-11 brand-gradient text-base font-semibold">
                {loading ? "Enviando…" : "Enviar link"}
              </Button>
              <button type="button" onClick={() => setMode("login")} className="w-full text-xs text-muted-foreground hover:text-foreground">
                ← Voltar ao login
              </button>
            </form>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === "signup" && (
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Nome completo</Label>
                    <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="h-11" />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-11" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Senha</Label>
                    {mode === "login" && (
                      <button type="button" onClick={() => setMode("forgot")} className="text-xs text-primary font-medium hover:underline">
                        Esqueci minha senha
                      </button>
                    )}
                  </div>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="h-11" />
                </div>
                <Button type="submit" disabled={loading} className="w-full h-11 brand-gradient text-base font-semibold">
                  {loading ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}
                </Button>
              </form>

              {mode === "signup" && (
                <p className="mt-4 text-xs text-muted-foreground text-center">
                  O primeiro usuário criado será automaticamente administrador do sistema.
                </p>
              )}
            </>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          <Link to="/" className="hover:underline">← Voltar</Link>
        </p>
      </div>
    </div>
  );
}
