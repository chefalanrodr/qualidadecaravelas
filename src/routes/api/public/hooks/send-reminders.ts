import { createFileRoute } from "@tanstack/react-router";
import webpush from "web-push";

type Sub = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_id: string;
};

type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  requireInteraction?: boolean;
};

async function sendToSubscription(sub: Sub, payload: PushPayload): Promise<{ ok: boolean; gone: boolean; error?: string }> {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 24 },
    );
    return { ok: true, gone: false };
  } catch (e: unknown) {
    const err = e as { statusCode?: number; message?: string };
    const gone = err.statusCode === 404 || err.statusCode === 410;
    return { ok: false, gone, error: err.message ?? "unknown" };
  }
}

export const Route = createFileRoute("/api/public/hooks/send-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Auth via Supabase anon key (default pattern for /api/public/* cron hooks).
        const apiKey = request.headers.get("apikey");
        const expectedKey = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!expectedKey || apiKey !== expectedKey) {
          return new Response("Unauthorized", { status: 401 });
        }

        const vapidPublic = process.env.VAPID_PUBLIC_KEY;
        const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
        const vapidSubject = process.env.VAPID_SUBJECT || "mailto:notifications@example.com";
        if (!vapidPublic || !vapidPrivate) {
          return Response.json({ error: "VAPID keys not configured" }, { status: 500 });
        }
        webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // 1. Detect pending weekly audit (semana ISO atual sem auditoria "concluido").
        const now = new Date();
        const day = now.getUTCDay();
        const isoWeek = getIsoWeek(now);
        const isoYear = getIsoWeekYear(now);

        const notifyUserIds = new Set<string>();
        const messages: Array<{ userId: string; payload: PushPayload }> = [];

        // Weekly audit reminder: sexta (5), sábado (6), domingo (0) sem auditoria da semana ISO.
        if (day === 5 || day === 6 || day === 0) {
          const { data: weekAudits } = await supabaseAdmin
            .from("quality_audits")
            .select("id, status, iso_week, iso_year")
            .eq("iso_week", isoWeek)
            .eq("iso_year", isoYear)
            .eq("status", "concluido")
            .limit(1);
          if (!weekAudits || weekAudits.length === 0) {
            const { data: auditors } = await supabaseAdmin
              .from("user_roles")
              .select("user_id, role")
              .in("role", ["admin", "gestor"]);
            (auditors ?? []).forEach((r) => {
              if (r.user_id && !notifyUserIds.has(`${r.user_id}:audit`)) {
                notifyUserIds.add(`${r.user_id}:audit`);
                messages.push({
                  userId: r.user_id,
                  payload: {
                    title: "Auditoria semanal pendente",
                    body: `A auditoria da semana ${isoWeek}/${isoYear} ainda não foi concluída.`,
                    url: "/quality",
                    tag: `audit-${isoWeek}-${isoYear}`,
                    requireInteraction: true,
                  },
                });
              }
            });
          }
        }

        // 2. Action plans vencendo em <=24h ou vencidos e ainda abertos.
        const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
        const { data: plans } = await supabaseAdmin
          .from("action_plans")
          .select("id, description, due_date, responsible_user_id, status")
          .eq("status", "aberto")
          .not("due_date", "is", null)
          .lte("due_date", in24h);
        (plans ?? []).forEach((p) => {
          if (!p.responsible_user_id) return;
          const overdue = p.due_date ? new Date(p.due_date) < now : false;
          messages.push({
            userId: p.responsible_user_id,
            payload: {
              title: overdue ? "Plano de ação vencido" : "Plano de ação vence hoje",
              body: (p.description ?? "").slice(0, 140),
              url: "/action-plans",
              tag: `plan-${p.id}`,
              requireInteraction: overdue,
            },
          });
        });

        if (messages.length === 0) {
          return Response.json({ sent: 0, cleaned: 0, message: "nothing to send" });
        }

        // Fetch subs for all target users in one shot.
        const userIds = [...new Set(messages.map((m) => m.userId))];
        const { data: subs } = await supabaseAdmin
          .from("push_subscriptions")
          .select("id, endpoint, p256dh, auth, user_id")
          .in("user_id", userIds);

        const subsByUser = new Map<string, Sub[]>();
        (subs ?? []).forEach((s) => {
          const arr = subsByUser.get(s.user_id) ?? [];
          arr.push(s as Sub);
          subsByUser.set(s.user_id, arr);
        });

        let sent = 0;
        const goneIds: string[] = [];
        for (const m of messages) {
          const userSubs = subsByUser.get(m.userId) ?? [];
          for (const s of userSubs) {
            const res = await sendToSubscription(s, m.payload);
            if (res.ok) sent++;
            if (res.gone) goneIds.push(s.id);
          }
        }

        if (goneIds.length) {
          await supabaseAdmin.from("push_subscriptions").delete().in("id", goneIds);
        }

        return Response.json({ sent, cleaned: goneIds.length, targeted: messages.length });
      },
    },
  },
});

// ISO week helpers (Mondays; matches quality module).
function getIsoWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
function getIsoWeekYear(d: Date): number {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  return date.getUTCFullYear();
}
