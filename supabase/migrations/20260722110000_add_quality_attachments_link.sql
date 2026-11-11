ALTER TABLE public.attachments
  ADD COLUMN IF NOT EXISTS quality_answer_id UUID REFERENCES public.quality_audit_answers(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_attachments_quality_answer_id
  ON public.attachments(quality_answer_id);

UPDATE public.attachments a
SET quality_answer_id = a.answer_id,
    answer_id = NULL
WHERE a.quality_answer_id IS NULL
  AND a.answer_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.quality_audit_answers q
    WHERE q.id = a.answer_id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.checklist_answers c
    WHERE c.id = a.answer_id
  );
