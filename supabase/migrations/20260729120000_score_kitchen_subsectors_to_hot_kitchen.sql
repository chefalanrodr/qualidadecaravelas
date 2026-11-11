-- Make the kitchen support sub-sectors count toward Cozinha Quente.
-- They remain auditable as their own sectors, but their score no longer creates
-- an independent sector score in reports.
WITH hot_kitchen AS (
  SELECT id
  FROM public.quality_sectors
  WHERE lower(trim(name)) = 'cozinha quente'
  ORDER BY position
  LIMIT 1
),
source_sectors AS (
  SELECT id
  FROM public.quality_sectors
  WHERE lower(trim(name)) IN (
    'higiene de panelas',
    'câmara refrigerada cozinha',
    'camara refrigerada cozinha'
  )
)
UPDATE public.quality_items item
SET score_sector_id = hot_kitchen.id
FROM hot_kitchen
WHERE item.sector_id IN (SELECT id FROM source_sectors)
  AND item.score_sector_id IS DISTINCT FROM hot_kitchen.id;
