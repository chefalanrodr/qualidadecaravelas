
WITH tpl AS (
  INSERT INTO public.checklist_templates (slug, name, description, kind, sector_id, is_active, sort_order)
  VALUES ('encerramento-delivery', 'Encerramento Delivery', 'Rotina de encerramento do setor de Delivery.', 'operacional', '84725a41-1e68-42c8-b3d2-d4d9f52b80dd', true, 24)
  ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, sector_id = EXCLUDED.sector_id, kind = EXCLUDED.kind, is_active = true, sort_order = EXCLUDED.sort_order
  RETURNING id
)
INSERT INTO public.checklist_items (template_id, position, title, guidance, priority, is_critical, weight, requires_photo_on_conforme)
SELECT tpl.id, x.position, x.title, x.guidance, x.priority::item_priority, x.is_critical, x.weight, x.req
FROM tpl, (VALUES
  (1, 'Desligar equipamentos', 'Desligar computador, impressora, tablets e demais equipamentos operacionais.', 'medio', false, 2, false),
  (2, 'Checar celulares, maquinetas e colocar para carregar', 'Conferir dispositivos e conectar todos aos carregadores.', 'alto', true, 3, false),
  (3, 'Higienizar espaço de trabalho', 'Limpar bancadas, superfícies e utensílios da área de delivery.', 'medio', false, 2, false),
  (4, 'Quem fez este relatório?', 'Registrar o nome do responsável nas observações.', 'baixo', false, 1, false)
) AS x(position, title, guidance, priority, is_critical, weight, req)
ON CONFLICT DO NOTHING;
