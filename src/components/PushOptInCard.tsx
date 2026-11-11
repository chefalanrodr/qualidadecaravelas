import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bell, BellOff, Loader2 } from "lucide-react";
import {
  currentSubscriptionEndpoint,
  pushPermission,
  pushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push-client";
import { savePushSubscription, removePushSubscription } from "@/lib/push.functions";

export function PushOptInCard() {
  const [status, setStatus] = useState<"unsupported" | "loading" | "disabled" | "enabled">("loading");
  const [busy, setBusy] = useState(false);
  const save = useServerFn(savePushSubscription);
  const remove = useServerFn(removePushSubscription);

  useEffect(() => {
    (async () => {
      if (!pushSupported()) return setStatus("unsupported");
      if (pushPermission() !== "granted") return setStatus("disabled");
      const ep = await currentSubscriptionEndpoint();
      setStatus(ep ? "enabled" : "disabled");
    })();
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const sub = await subscribeToPush();
      if (!sub || !sub.endpoint || !sub.keys) {
        toast.error("Permissão negada ou navegador não suporta.");
        return;
      }
      await save({
        data: {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.keys.p256dh!, auth: sub.keys.auth! },
          userAgent: navigator.userAgent.slice(0, 500),
        },
      });
      setStatus("enabled");
      toast.success("Notificações ativadas");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao ativar");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const endpoint = await unsubscribeFromPush();
      if (endpoint) await remove({ data: { endpoint } });
      setStatus("disabled");
      toast.success("Notificações desativadas");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao desativar");
    } finally {
      setBusy(false);
    }
  }

  if (status === "unsupported") return null;
  if (status === "loading") return null;

  const iOS = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const iOSStandalone = typeof window !== "undefined"
    && (window.matchMedia?.("(display-mode: standalone)").matches
      || (window.navigator as unknown as { standalone?: boolean }).standalone === true);

  return (
    <div className="card-elevated p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl grid place-items-center ${status === "enabled" ? "bg-success/15 text-success" : "bg-primary/10 text-primary"}`}>
        {status === "enabled" ? <Bell className="w-5 h-5"/> : <BellOff className="w-5 h-5"/>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">
          {status === "enabled" ? "Notificações ativadas" : "Ativar notificações"}
        </div>
        <div className="text-xs text-muted-foreground">
          {status === "enabled"
            ? "Você recebe lembretes de auditoria e planos vencendo."
            : iOS && !iOSStandalone
              ? "No iOS instale o app pelo Safari (Adicionar à Tela de Início) para receber push."
              : "Lembretes de auditoria semanal e planos de ação."}
        </div>
      </div>
      <button
        type="button"
        onClick={status === "enabled" ? disable : enable}
        disabled={busy || (iOS && !iOSStandalone && status !== "enabled")}
        className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold ${status === "enabled" ? "border border-border" : "brand-gradient text-white"} disabled:opacity-60`}
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin"/> : status === "enabled" ? "Desativar" : "Ativar"}
      </button>
    </div>
  );
}
