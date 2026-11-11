
ALTER TABLE public.action_plans
  ADD COLUMN IF NOT EXISTS answer_id UUID REFERENCES public.checklist_answers(id) ON DELETE CASCADE;

UPDATE public.checklist_items SET priority = 'media' WHERE priority IS NULL;
ALTER TABLE public.checklist_items ALTER COLUMN priority SET DEFAULT 'media';
ALTER TABLE public.checklist_items ALTER COLUMN priority SET NOT NULL;

ALTER TABLE public.checklist_items
  ALTER COLUMN evidence_hints TYPE TEXT[]
  USING CASE WHEN evidence_hints IS NULL OR evidence_hints = '' THEN ARRAY[]::TEXT[]
             ELSE string_to_array(evidence_hints, E'\n') END;
ALTER TABLE public.checklist_items ALTER COLUMN evidence_hints SET DEFAULT ARRAY[]::TEXT[];
