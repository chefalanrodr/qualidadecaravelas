
ALTER TABLE public.checklist_items
  ADD COLUMN IF NOT EXISTS is_required boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_not_applicable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_goal boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS goal_value text,
  ADD COLUMN IF NOT EXISTS evidence_hints jsonb NOT NULL DEFAULT '[]'::jsonb;
