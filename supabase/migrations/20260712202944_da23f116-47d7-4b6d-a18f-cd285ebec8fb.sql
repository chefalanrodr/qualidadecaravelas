
WITH tpl AS (
  INSERT INTO public.checklist_templates (slug, name, description, kind, sector_id, is_active, sort_order)
  VALUES ('abertura-delivery', 'Abertura Delivery', 'Rotina de abertura do setor de Delivery.', 'operacional', '84725a41-1e68-42c8-b3d2-d4d9f52b80dd', true, 23)
  ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, sector_id = EXCLUDED.sector_id, kind = EXCLUDED.kind, is_active = true, sort_order = EXCLUDED.sort_order
  RETURNING id
)
INSERT INTO public.checklist_items (template_id, position, title, guidance, priority, is_critical, weight, requires_photo_on_conforme)
SELECT tpl.id, x.position, x.title, x.guidance, x.priority::item_priority, x.is_critical, x.weight, x.req
FROM tpl, (VALUES
  (1, 'Higienizar espaço de trabalho', 'Limpar bancadas, superfícies e utensílios da área de delivery.', 'medio', false, 2, false),
  (2, 'Ligar equipamentos', 'Ligar computador, impressora, tablets e demais equipamentos operacionais.', 'medio', false, 2, false),
  (3, 'Checar celulares e necessidade de retorno aos clientes', 'Verificar mensagens pendentes e responder clientes que aguardam retorno.', 'alto', false, 3, false),
  (4, 'Checar sistemas de pedidos e garantir que estejam online', 'iFood, Rappi, WhatsApp e demais canais devem estar operacionais.', 'alto', true, 3, false),
  (5, 'Verificar sistema de reserva', 'Confirmar que o sistema de reservas está funcionando e sincronizado.', 'medio', false, 2, false),
  (6, 'Verificar quadro de insumos com a cozinha', 'Alinhar com a cozinha itens indisponíveis para bloqueio nos apps.', 'alto', true, 3, false),
  (7, 'Preparar embalagens e outros materiais', 'Separar embalagens, sacolas, talheres, guardanapos e etiquetas.', 'medio', false, 2, false),
  (8, 'Verificar avaliações e chamados do iFood', 'Responder avaliações recentes e tratar chamados abertos.', 'medio', false, 2, false),
  (9, 'Briefing rápido pré-serviço', 'Reunião breve com a equipe alinhando prioridades e novidades do dia.', 'medio', false, 2, false),
  (10, 'Quem fez este checklist?', 'Registrar o nome do responsável nas observações.', 'baixo', false, 1, false)
) AS x(position, title, guidance, priority, is_critical, weight, req)
ON CONFLICT DO NOTHING;
