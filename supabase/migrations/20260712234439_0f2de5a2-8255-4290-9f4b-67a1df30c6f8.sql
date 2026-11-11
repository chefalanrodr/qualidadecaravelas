
-- Storage policies for the attachments bucket
CREATE POLICY "Authenticated read attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'attachments');

CREATE POLICY "Authenticated upload attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'attachments');

CREATE POLICY "Authenticated update own attachments"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'attachments' AND owner = auth.uid());

CREATE POLICY "Authenticated delete own attachments"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'attachments' AND owner = auth.uid());

-- Ensure pg_cron is available for the daily overdue job
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Daily job: mark action plans as overdue when due date has passed
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mark-action-plans-overdue') THEN
    PERFORM cron.unschedule('mark-action-plans-overdue');
  END IF;
END $$;

SELECT cron.schedule(
  'mark-action-plans-overdue',
  '5 3 * * *',
  $$
    UPDATE public.action_plans
       SET status = 'vencido', updated_at = now()
     WHERE due_date IS NOT NULL
       AND due_date < CURRENT_DATE
       AND status NOT IN ('concluido','cancelado','vencido');
  $$
);
