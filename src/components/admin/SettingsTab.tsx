import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2, Save, Upload, Image as ImageIcon, RefreshCw, Wifi, WifiOff,
  Download, Upload as UploadIcon, Trash2, AlertTriangle, FileText, Clock3,
} from "lucide-react";
import { clearQueue, flushQueue, getLastSyncError, getQueueEntries, queueSize, subscribe, type QueueEntrySummary, type SyncLastError } from "@/lib/offline-queue";
import { toCsv, downloadCsv, exportRowsAsPdf } from "@/lib/reports-export";
import { format } from "date-fns";

type Settings = {
  id: number;
  name: string;
  logo_url: string | null;
  greeting: string | null;
};

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function SettingsTab() {
  return (
    <div className="space-y-4">
      <RestaurantCard />
      <SyncCard />
      <DataCard />
    </div>
  );
}

/* ============ Restaurante ============ */
function RestaurantCard() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [greeting, setGreeting] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["restaurant-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurant_settings")
        .select("id, name, logo_url, greeting")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? { id: 1, name: "Meu Restaurante", logo_url: null, greeting: null }) as Settings;
    },
  });

  useEffect(() => {
    if (data) {
      setName(data.name ?? "");
      setGreeting(data.greeting ?? "");
      setLogoUrl(data.logo_url ?? null);
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("restaurant_settings")
        .update({ name: name.trim() || "Meu Restaurante", greeting: greeting.trim() || null, logo_url: logoUrl })
        .eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configurações salvas");
      qc.invalidateQueries({ queryKey: ["restaurant-settings"] });
      qc.invalidateQueries({ queryKey: ["home-restaurant"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `restaurant/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("logos").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: signed, error: signErr } = await supabase.storage.from("logos").createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
      if (signErr) throw signErr;
      setLogoUrl(signed.signedUrl);
      toast.success("Logo enviado. Clique em Salvar para confirmar.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  if (isLoading) {
    return <div className="card-elevated p-6 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  }

  return (
    <section className="card-elevated p-4 space-y-4">
      <header>
        <h2 className="font-semibold">Restaurante</h2>
        <p className="text-xs text-muted-foreground">Identidade exibida na tela inicial e nos relatórios.</p>
      </header>

      <div className="flex items-start gap-4">
        <div className="shrink-0">
          <div className="w-20 h-20 rounded-2xl bg-muted overflow-hidden grid place-items-center border border-border">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <ImageIcon className="w-6 h-6 text-muted-foreground" />
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="mt-2 w-20 inline-flex items-center justify-center gap-1 h-8 text-xs rounded-md bg-secondary hover:bg-muted"
          >
            {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            Logo
          </button>
        </div>

        <div className="flex-1 space-y-3">
          <Field label="Nome do restaurante">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-border bg-background"
              placeholder="Meu Restaurante"
            />
          </Field>
          <Field label="Saudação na tela inicial" hint="Aparece na home, ex: “Bem-vindo à equipe!”">
            <input
              value={greeting}
              onChange={(e) => setGreeting(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-border bg-background"
              placeholder="Olá, tudo pronto para o turno?"
            />
          </Field>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-60"
        >
          {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar
        </button>
      </div>
    </section>
  );
}

/* ============ Sincronização ============ */
function SyncCard() {
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [pending, setPending] = useState(queueSize());
  const [entries, setEntries] = useState<QueueEntrySummary[]>(getQueueEntries());
  const [lastError, setLastError] = useState<SyncLastError | null>(getLastSyncError());
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    const unsub = subscribe((c) => {
      setPending(c);
      setEntries(getQueueEntries());
      setLastError(getLastSyncError());
    });
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      unsub();
    };
  }, []);

  async function handleSync() {
    setSyncing(true);
    try {
      const { sent, failed, deferred } = await flushQueue();
      setPending(queueSize());
      setEntries(getQueueEntries());
      setLastError(getLastSyncError());
      if (deferred) toast.info("Aguardando conexao estavel para sincronizar");
      else if (sent === 0 && failed === 0) toast.info("Nada para sincronizar");
      else if (failed > 0) toast.warning(`${sent} enviados, ${failed} falharam`);
      else toast.success(`${sent} respostas sincronizadas`);
    } finally {
      setSyncing(false);
    }
  }

  function handleClearQueue() {
    const ok = window.confirm(
      "Limpar as alteracoes pendentes deste aparelho? Use apenas se elas ja aparecem no sistema ou se voce quer descartar a fila travada.",
    );
    if (!ok) return;
    clearQueue();
    setPending(0);
    setEntries([]);
    setLastError(null);
    toast.success("Fila local limpa");
  }

  return (
    <section className="card-elevated p-4 space-y-3">
      <header>
        <h2 className="font-semibold">Sincronização</h2>
        <p className="text-xs text-muted-foreground">Envia checklists, auditorias e fotos salvas offline para o servidor.</p>
      </header>

      <div className="flex items-center gap-3">
        <div className={`inline-flex items-center gap-2 px-3 h-9 rounded-full text-sm font-medium ${online ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>
          {online ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
          {online ? "Online" : "Sem conexão"}
        </div>
        <div className="text-sm">
          <span className="font-semibold">{pending}</span>{" "}
          <span className="text-muted-foreground">na fila</span>
        </div>
        <button
          onClick={handleSync}
          disabled={!online || syncing || pending === 0}
          className="ml-auto inline-flex items-center gap-2 h-9 px-4 rounded-md bg-secondary hover:bg-muted text-sm font-medium disabled:opacity-50"
        >
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Sincronizar agora
        </button>
      </div>
      {pending > 0 && lastError && (
        <div className={`rounded-md border p-3 text-sm ${lastError.retryable ? "border-amber-300 bg-amber-50 text-amber-800" : "border-destructive/30 bg-destructive/10 text-destructive"}`}>
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{lastError.retryable ? "Aguardando conexao estavel." : "A fila de sincronizacao travou."}</p>
              <p className="mt-1 text-xs">{lastError.message}</p>
              <button
                type="button"
                onClick={handleClearQueue}
                className={`mt-3 inline-flex h-8 items-center gap-2 rounded-md px-3 text-xs font-semibold hover:opacity-90 ${lastError.retryable ? "bg-amber-200 text-amber-950" : "bg-destructive text-destructive-foreground"}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Limpar fila local
              </button>
            </div>
          </div>
        </div>
      )}
      {entries.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="bg-muted/60 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Alteracoes pendentes neste aparelho
          </div>
          <div className="divide-y divide-border">
            {entries.map((entry) => (
              <div key={`${entry.type}-${entry.id}`} className="px-3 py-2 text-sm flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold">{entry.title}</div>
                  <div className="text-xs text-muted-foreground">{entry.detail}</div>
                </div>
                <div className="text-xs text-muted-foreground inline-flex items-center gap-1 shrink-0">
                  <Clock3 className="h-3 w-3" />
                  {new Date(entry.queuedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

/* ============ Dados / Histórico ============ */
type Domain = "checklists" | "audits";
const DOMAIN_LABEL: Record<Domain, string> = {
  checklists: "Checklists operacionais",
  audits: "Auditorias de qualidade",
};

function DataCard() {
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDomain, setConfirmDomain] = useState<Domain | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const importRef = useRef<HTMLInputElement>(null);

  async function exportData(domain: Domain, fmt: "csv" | "pdf") {
    setBusy(`export-${domain}-${fmt}`);
    try {
      const stamp = format(new Date(), "yyyy-MM-dd");
      if (domain === "checklists") {
        const { data, error } = await supabase
          .from("checklist_executions")
          .select("id, started_at, finished_at, status, score, template:checklist_templates(name, sector:sectors(name)), auditor:profiles(full_name)")
          .order("started_at", { ascending: false });
        if (error) throw error;
        const rows = (data ?? []).map((r) => ({
          data: r.started_at ? format(new Date(r.started_at), "dd/MM/yyyy HH:mm") : "",
          finalizada: r.finished_at ? format(new Date(r.finished_at), "dd/MM/yyyy HH:mm") : "",
          setor: (r as { template?: { sector?: { name?: string } | null } | null }).template?.sector?.name ?? "",
          checklist: (r as { template?: { name?: string } | null }).template?.name ?? "",
          responsavel: (r as { auditor?: { full_name?: string } | null }).auditor?.full_name ?? "",
          status: r.status ?? "",
          score: r.score != null ? `${Number(r.score).toFixed(1)}%` : "",
        }));
        const columns = [
          { header: "Data", accessor: (r: typeof rows[number]) => r.data },
          { header: "Finalizada", accessor: (r: typeof rows[number]) => r.finalizada },
          { header: "Setor", accessor: (r: typeof rows[number]) => r.setor },
          { header: "Checklist", accessor: (r: typeof rows[number]) => r.checklist },
          { header: "Responsável", accessor: (r: typeof rows[number]) => r.responsavel },
          { header: "Status", accessor: (r: typeof rows[number]) => r.status },
          { header: "Score", accessor: (r: typeof rows[number]) => r.score },
        ];
        if (fmt === "csv") {
          downloadCsv(`checklists-${stamp}.csv`, toCsv(rows, columns));
        } else {
          await exportRowsAsPdf({ title: "Relatório de Checklists", subtitle: `${rows.length} execuções`, filename: `checklists-${stamp}.pdf`, rows, columns });
        }
      } else {
        const { data, error } = await supabase
          .from("quality_audits")
          .select("id, started_at, finished_at, iso_year, iso_week, month, year, status, score, auditor:profiles(full_name)")
          .order("started_at", { ascending: false });
        if (error) throw error;
        const rows = (data ?? []).map((r) => ({
          data: r.started_at ? format(new Date(r.started_at), "dd/MM/yyyy HH:mm") : "",
          finalizada: r.finished_at ? format(new Date(r.finished_at), "dd/MM/yyyy HH:mm") : "",
          semana: `S${r.iso_week}/${r.iso_year}`,
          mes: `${String(r.month).padStart(2, "0")}/${r.year}`,
          auditor: (r as { auditor?: { full_name?: string } | null }).auditor?.full_name ?? "",
          status: r.status ?? "",
          score: r.score != null ? `${Number(r.score).toFixed(1)}%` : "",
        }));
        const columns = [
          { header: "Data", accessor: (r: typeof rows[number]) => r.data },
          { header: "Finalizada", accessor: (r: typeof rows[number]) => r.finalizada },
          { header: "Semana ISO", accessor: (r: typeof rows[number]) => r.semana },
          { header: "Mês", accessor: (r: typeof rows[number]) => r.mes },
          { header: "Auditor", accessor: (r: typeof rows[number]) => r.auditor },
          { header: "Status", accessor: (r: typeof rows[number]) => r.status },
          { header: "Score", accessor: (r: typeof rows[number]) => r.score },
        ];
        if (fmt === "csv") {
          downloadCsv(`auditorias-${stamp}.csv`, toCsv(rows, columns));
        } else {
          await exportRowsAsPdf({ title: "Relatório de Auditorias de Qualidade", subtitle: `${rows.length} auditorias`, filename: `auditorias-${stamp}.pdf`, rows, columns });
        }
      }
      toast.success(`Exportação de ${DOMAIN_LABEL[domain]} concluída`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function importData(file: File) {
    setBusy("import");
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      if (json.kind === "checklists") {
        if (Array.isArray(json.checklist_executions) && json.checklist_executions.length) {
          const { error } = await supabase.from("checklist_executions").upsert(json.checklist_executions);
          if (error) throw error;
        }
        if (Array.isArray(json.checklist_answers) && json.checklist_answers.length) {
          const { error } = await supabase.from("checklist_answers").upsert(json.checklist_answers);
          if (error) throw error;
        }
      } else if (json.kind === "audits") {
        if (Array.isArray(json.quality_audits) && json.quality_audits.length) {
          const { error } = await supabase.from("quality_audits").upsert(json.quality_audits);
          if (error) throw error;
        }
        if (Array.isArray(json.quality_audit_sectors) && json.quality_audit_sectors.length) {
          const { error } = await supabase.from("quality_audit_sectors").upsert(json.quality_audit_sectors);
          if (error) throw error;
        }
        if (Array.isArray(json.quality_audit_answers) && json.quality_audit_answers.length) {
          const { error } = await supabase.from("quality_audit_answers").upsert(json.quality_audit_answers);
          if (error) throw error;
        }
      } else {
        throw new Error("Arquivo não reconhecido");
      }
      toast.success("Importação concluída");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function runClear(domain: Domain) {
    const label = DOMAIN_LABEL[domain];
    setBusy(`clear-${domain}`);
    try {
      if (domain === "checklists") {
        const { error: e1 } = await supabase.from("checklist_answers").delete().not("id", "is", null);
        if (e1) throw e1;
        const { error: e2 } = await supabase.from("checklist_executions").delete().not("id", "is", null);
        if (e2) throw e2;
      } else {
        // action_plans referencia quality_audits (SET NULL) e quality_audit_answers (SET NULL);
        // limpamos antes para remover NCs órfãs vinculadas às auditorias.
        const { error: e0 } = await supabase.from("action_plans").delete().not("quality_audit_id", "is", null);
        if (e0) throw e0;
        const { error: e1 } = await supabase.from("quality_audit_answers").delete().not("id", "is", null);
        if (e1) throw e1;
        const { error: e2 } = await supabase.from("quality_audit_sectors").delete().not("id", "is", null);
        if (e2) throw e2;
        const { error: e3 } = await supabase.from("quality_audits").delete().not("id", "is", null);
        if (e3) throw e3;
      }
      toast.success(`${label} apagado`);
      setConfirmDomain(null);
      setConfirmText("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="card-elevated p-4 space-y-4">
      <header>
        <h2 className="font-semibold">Dados & Histórico</h2>
        <p className="text-xs text-muted-foreground">Exporte, importe ou limpe o histórico. Apenas administradores.</p>
      </header>

      <input
        ref={importRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) importData(f);
          e.target.value = "";
        }}
      />

      <div className="grid gap-2">
        {(Object.keys(DOMAIN_LABEL) as Domain[]).map((d) => (
          <div key={d} className="flex flex-wrap items-center gap-2 p-3 rounded-lg border border-border">
            <div className="flex-1 min-w-[160px]">
              <div className="font-medium text-sm">{DOMAIN_LABEL[d]}</div>
            </div>
            <button
              onClick={() => exportData(d, "csv")}
              disabled={busy !== null}
              className="inline-flex items-center gap-1 h-8 px-3 rounded-md bg-secondary hover:bg-muted text-xs font-medium disabled:opacity-50"
            >
              {busy === `export-${d}-csv` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
              CSV
            </button>
            <button
              onClick={() => exportData(d, "pdf")}
              disabled={busy !== null}
              className="inline-flex items-center gap-1 h-8 px-3 rounded-md bg-secondary hover:bg-muted text-xs font-medium disabled:opacity-50"
            >
              {busy === `export-${d}-pdf` ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
              PDF
            </button>
            <button
              onClick={() => { setConfirmDomain(d); setConfirmText(""); }}
              disabled={busy !== null}
              className="inline-flex items-center gap-1 h-8 px-3 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 text-xs font-medium disabled:opacity-50"
            >
              {busy === `clear-${d}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              Limpar
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => importRef.current?.click()}
          disabled={busy !== null}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-secondary hover:bg-muted text-sm font-medium disabled:opacity-50"
        >
          {busy === "import" ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadIcon className="w-4 h-4" />}
          Importar arquivo JSON
        </button>
        <div className="flex items-center gap-1 text-xs text-warning">
          <AlertTriangle className="w-3 h-3" />
          Operação irreversível
        </div>
      </div>

      {confirmDomain && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog">
          <div className="absolute inset-0 bg-black/50" onClick={() => busy === null && setConfirmDomain(null)} />
          <div className="relative w-full max-w-md bg-card rounded-2xl shadow-2xl border border-border p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-destructive/10 text-destructive grid place-items-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold">Apagar {DOMAIN_LABEL[confirmDomain]}</div>
                <div className="text-xs text-muted-foreground">
                  Isso remove <b>todos</b> os registros e não pode ser desfeito. Digite <b>APAGAR</b> para confirmar.
                </div>
              </div>
            </div>
            <input
              autoFocus
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="APAGAR"
              className="w-full h-10 px-3 rounded-md border border-border bg-background font-mono"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDomain(null)}
                disabled={busy !== null}
                className="h-9 px-3 rounded-md bg-secondary hover:bg-muted text-sm font-medium disabled:opacity-50"
              >Cancelar</button>
              <button
                onClick={() => runClear(confirmDomain)}
                disabled={confirmText !== "APAGAR" || busy !== null}
                className="h-9 px-3 rounded-md bg-destructive text-destructive-foreground text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-2"
              >
                {busy?.startsWith("clear-") ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Apagar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function download(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
