import { useEffect, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, CloudUpload, Clock3, RefreshCw, Trash2, WifiOff } from "lucide-react";
import { clearQueue, flushQueue, getLastSyncError, getQueueEntries, subscribe, type QueueEntrySummary, type SyncLastError } from "@/lib/offline-queue";

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function QueueDetails({ entries }: { entries: QueueEntrySummary[] }) {
  if (!entries.length) return null;
  return (
    <div className="mt-3 max-h-44 overflow-y-auto rounded-md bg-white/10 p-2">
      <div className="space-y-1.5">
        {entries.map((entry) => (
          <div key={`${entry.type}-${entry.id}`} className="rounded bg-white/10 px-2 py-1.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">{entry.title}</span>
              <span className="inline-flex items-center gap-1 opacity-80"><Clock3 className="h-3 w-3" />{formatTime(entry.queuedAt)}</span>
            </div>
            <div className="mt-0.5 opacity-85">{entry.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function OfflineIndicator() {
  const [online, setOnline] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [pending, setPending] = useState(0);
  const [lastError, setLastError] = useState<SyncLastError | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [entries, setEntries] = useState<QueueEntrySummary[]>([]);
  const [showDetails, setShowDetails] = useState(false);

  function refreshQueueState() {
    setPending(getQueueEntries().length);
    setEntries(getQueueEntries());
    setLastError(getLastSyncError());
  }

  useEffect(() => {
    setMounted(true);
    setOnline(navigator.onLine);
    refreshQueueState();

    async function sync() {
      setSyncing(true);
      try {
        await flushQueue();
      } finally {
        refreshQueueState();
        setSyncing(false);
      }
    }

    let onlineTimer: number | undefined;
    const on = () => {
      setOnline(true);
      window.clearTimeout(onlineTimer);
      onlineTimer = window.setTimeout(sync, 2_000);
    };
    const off = () => setOnline(false);

    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    const unsub = subscribe((count) => {
      setPending(count);
      setEntries(getQueueEntries());
      setLastError(getLastSyncError());
    });

    return () => {
      window.clearTimeout(onlineTimer);
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      unsub();
    };
  }, []);

  async function handleRetry() {
    setSyncing(true);
    try {
      await flushQueue();
    } finally {
      refreshQueueState();
      setSyncing(false);
    }
  }

  function handleClear() {
    const ok = window.confirm(
      "Limpar as alteracoes pendentes deste aparelho? Use apenas se elas ja aparecem no sistema ou se voce quer descartar a fila travada.",
    );
    if (!ok) return;
    clearQueue();
    refreshQueueState();
  }

  if (!mounted) return null;

  if (!online) {
    return (
      <div className="fixed bottom-4 left-1/2 z-50 w-[min(calc(100vw-2rem),520px)] -translate-x-1/2 rounded-lg bg-amber-500/95 px-4 py-3 text-sm font-medium text-white shadow-lg backdrop-blur">
        <div className="flex items-center gap-2">
          <WifiOff className="h-4 w-4 shrink-0" />
          <span className="flex-1">{pending > 0 ? `Offline - ${pending} alteracao(oes) na fila` : "Offline - alteracoes serao sincronizadas ao reconectar"}</span>
          {pending > 0 && (
            <button type="button" onClick={() => setShowDetails((value) => !value)} className="rounded-md p-1 hover:bg-white/15">
              {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          )}
        </div>
        {showDetails && <QueueDetails entries={entries} />}
      </div>
    );
  }

  if (pending > 0 && lastError) {
    const retryable = Boolean(lastError.retryable);
    return (
      <div className={`fixed bottom-4 left-1/2 z-50 w-[min(calc(100vw-2rem),520px)] -translate-x-1/2 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg backdrop-blur ${retryable ? "bg-amber-500/95" : "bg-destructive/95"}`}>
        <div className="flex items-start gap-3">
          {retryable ? <CloudUpload className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
          <div className="min-w-0 flex-1">
            <p>{retryable ? `${pending} alteracao(oes) aguardando conexao estavel.` : `${pending} alteracao(oes) nao sincronizou.`}</p>
            <p className="mt-1 line-clamp-2 text-xs opacity-90">{lastError.message}</p>
            {showDetails && <QueueDetails entries={entries} />}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleRetry}
                disabled={syncing}
                className="inline-flex h-8 items-center gap-2 rounded-md bg-white/15 px-3 text-xs font-semibold hover:bg-white/25 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
                Tentar agora
              </button>
              <button
                type="button"
                onClick={() => setShowDetails((value) => !value)}
                className="inline-flex h-8 items-center gap-2 rounded-md bg-white/15 px-3 text-xs font-semibold hover:bg-white/25"
              >
                {showDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                Detalhes
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="inline-flex h-8 items-center gap-2 rounded-md bg-white/15 px-3 text-xs font-semibold hover:bg-white/25"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Limpar fila
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (pending > 0) {
    return (
      <div className="fixed bottom-4 left-1/2 z-50 w-[min(calc(100vw-2rem),520px)] -translate-x-1/2 rounded-lg bg-primary/95 px-4 py-3 text-sm font-medium text-white shadow-lg backdrop-blur">
        <div className="flex items-center gap-2">
          {syncing ? <RefreshCw className="h-4 w-4 animate-spin shrink-0" /> : <CloudUpload className="h-4 w-4 shrink-0" />}
          <span className="flex-1">{syncing ? `Sincronizando ${pending} alteracao(oes)...` : `${pending} alteracao(oes) aguardando sincronizacao...`}</span>
          <button type="button" onClick={() => setShowDetails((value) => !value)} className="rounded-md p-1 hover:bg-white/15">
            {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
        {showDetails && <QueueDetails entries={entries} />}
      </div>
    );
  }

  return null;
}
