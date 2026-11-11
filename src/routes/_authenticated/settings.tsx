import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save, LogOut, KeyRound, User as UserIcon, Mail } from "lucide-react";
import { PushOptInCard } from "@/components/PushOptInCard";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-sm text-muted-foreground">Gerencie sua conta e preferências.</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Meu perfil</h2>
        <ProfileCard />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Segurança</h2>
        <PasswordCard />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Notificações</h2>
        <PushOptInCard />
      </section>


      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Sessão</h2>
        <SignOutCard />
      </section>
    </div>
  );
}

function ProfileCard() {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["me-profile"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data: p } = await supabase
        .from("profiles")
        .select("id, full_name, role_label")
        .eq("id", u.user.id)
        .maybeSingle();
      return { email: u.user.email ?? "", user_id: u.user.id, full_name: p?.full_name ?? "", role_label: p?.role_label ?? null };
    },
  });

  useEffect(() => {
    if (data) {
      setEmail(data.email);
      setName(data.full_name ?? "");
      setUserId(data.user_id);
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Sem usuário");
      const trimmed = name.trim();
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: userId, full_name: trimmed || null }, { onConflict: "id" });
      if (error) throw error;
      await supabase.auth.updateUser({ data: { full_name: trimmed } });
    },
    onSuccess: () => {
      toast.success("Perfil atualizado");
      qc.invalidateQueries({ queryKey: ["me-profile"] });
      qc.invalidateQueries({ queryKey: ["home-restaurant"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return <div className="card-elevated p-6 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  }

  return (
    <div className="card-elevated p-4 space-y-4">
      <label className="block space-y-1">
        <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5"><UserIcon className="w-3 h-3" /> Nome completo</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Seu nome"
          className="w-full h-10 px-3 rounded-md border border-border bg-background text-sm"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5"><Mail className="w-3 h-3" /> E-mail</span>
        <input
          value={email}
          readOnly
          disabled
          className="w-full h-10 px-3 rounded-md border border-border bg-muted/40 text-sm text-muted-foreground"
        />
        <span className="block text-[11px] text-muted-foreground">Para alterar o e-mail, fale com um administrador.</span>
      </label>
      {data?.role_label && (
        <div className="text-xs text-muted-foreground">Perfil de acesso: <b className="text-foreground">{data.role_label}</b></div>
      )}
      <div className="flex justify-end">
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending || !name.trim()}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
        >
          {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar
        </button>
      </div>
    </div>
  );
}

function PasswordCard() {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (pw.length < 8) return toast.error("A senha precisa ter pelo menos 8 caracteres.");
    if (pw !== pw2) return toast.error("As senhas não coincidem.");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Senha atualizada");
    setPw(""); setPw2("");
  }

  return (
    <div className="card-elevated p-4 space-y-3">
      <div className="text-xs text-muted-foreground">Defina uma nova senha para acessar sua conta.</div>
      <input type="password" placeholder="Nova senha" value={pw} onChange={(e) => setPw(e.target.value)}
        className="w-full h-10 px-3 rounded-md border border-border bg-background text-sm" />
      <input type="password" placeholder="Confirmar nova senha" value={pw2} onChange={(e) => setPw2(e.target.value)}
        className="w-full h-10 px-3 rounded-md border border-border bg-background text-sm" />
      <div className="flex justify-end">
        <button
          onClick={submit}
          disabled={loading || !pw || !pw2}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
          Atualizar senha
        </button>
      </div>
    </div>
  );
}

function SignOutCard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  async function signOut() {
    setLoading(true);
    await supabase.auth.signOut();
    setLoading(false);
    navigate({ to: "/auth" });
  }
  return (
    <div className="card-elevated p-4 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">Sair da conta</div>
        <div className="text-xs text-muted-foreground">Encerra a sessão neste dispositivo.</div>
      </div>
      <button
        onClick={signOut}
        disabled={loading}
        className="inline-flex items-center gap-2 h-9 px-3 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 text-sm font-semibold disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
        Sair
      </button>
    </div>
  );
}
