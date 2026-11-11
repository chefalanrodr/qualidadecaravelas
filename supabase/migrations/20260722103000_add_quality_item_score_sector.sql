-- Allows a quality audit question to be visually audited in one sector
-- while scoring another sector, such as maintenance.

ALTER TABLE public.quality_items
ADD COLUMN IF NOT EXISTS score_sector_id uuid REFERENCES public.quality_sectors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quality_items_score_sector_id
ON public.quality_items(score_sector_id);
