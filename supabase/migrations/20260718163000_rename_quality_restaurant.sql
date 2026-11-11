UPDATE public.quality_areas
SET name = 'Raiz cozinha brasileira',
    slug = 'raiz-cozinha-brasileira'
WHERE slug IN ('nom-fortaleza', 'auditoria-nom')
   OR name IN ('NOM FORTALEZA', 'Auditoria NOM');
