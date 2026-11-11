UPDATE public.quality_areas
SET is_active = true
WHERE is_active IS DISTINCT FROM true;

UPDATE public.quality_sectors
SET is_active = true
WHERE is_active IS DISTINCT FROM true;

UPDATE public.quality_items
SET is_active = true
WHERE is_active IS DISTINCT FROM true;
