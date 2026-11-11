ALTER TABLE public.checklist_templates
  ADD COLUMN IF NOT EXISTS schedule_days smallint[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.checklist_templates.schedule_days IS
  'Dias da semana em que o checklist é obrigatório (0=domingo..6=sábado). Vazio = todos os dias.';