-- New operational sectors (Confeitaria, Banheiros) if missing
INSERT INTO public.sectors (name, slug, sort_order)
SELECT v.name, v.slug, v.sort_order FROM (VALUES
  ('Confeitaria','confeitaria', 60),
  ('Banheiros','banheiros', 70)
) AS v(name, slug, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.sectors s WHERE s.slug = v.slug);

DO $mig$
DECLARE v_sector uuid; v_tpl uuid;
BEGIN
  SELECT id INTO v_sector FROM public.sectors WHERE slug='almoxarifado';
  IF v_sector IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.checklist_templates WHERE slug='conferencia-almoxarifado') THEN
    INSERT INTO public.checklist_templates (sector_id, name, slug, description, kind, is_active, sort_order, schedule_days)
    VALUES (v_sector, 'Conferência do Almoxarifado', 'conferencia-almoxarifado', 'Checagem diária de estoque, validade e organização.', 'operacional', true, 10, ARRAY[1,2,3,4,5,6])
    RETURNING id INTO v_tpl;
    INSERT INTO public.checklist_items (template_id, position, title, guidance, is_critical) VALUES
      (v_tpl, 1, 'Temperatura das câmaras dentro do padrão', 'Refrigerada 0-5°C, congelada abaixo de -18°C.', true),
      (v_tpl, 2, 'Produtos organizados PVPS/PEPS', 'Primeiro que vence, primeiro que sai.', false),
      (v_tpl, 3, 'Nenhum item vencido em estoque', 'Retirar imediatamente qualquer produto vencido.', true),
      (v_tpl, 4, 'Prateleiras e piso limpos', 'Sem sujeira, poeira ou resíduos.', false),
      (v_tpl, 5, 'Estoque mínimo dos insumos principais', 'Registrar faltas para reposição.', false);
  END IF;

  SELECT id INTO v_sector FROM public.sectors WHERE slug='bar';
  IF v_sector IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.checklist_templates WHERE slug='abertura-bar') THEN
    INSERT INTO public.checklist_templates (sector_id, name, slug, description, kind, is_active, sort_order, schedule_days)
    VALUES (v_sector, 'Abertura do Bar', 'abertura-bar', 'Preparação e verificação do bar antes do atendimento.', 'operacional', true, 10, ARRAY[1,2,3,4,5,6,0])
    RETURNING id INTO v_tpl;
    INSERT INTO public.checklist_items (template_id, position, title, guidance, is_critical) VALUES
      (v_tpl, 1, 'Bancadas e utensílios higienizados', 'Uso de sanitizante adequado.', true),
      (v_tpl, 2, 'Estoque de bebidas conferido', 'Reposição feita antes do serviço.', false),
      (v_tpl, 3, 'Gelo abundante e limpo', 'Máquina/depósito higienizados.', true),
      (v_tpl, 4, 'Frutas frescas e higienizadas', 'Sem sinais de deterioração.', false),
      (v_tpl, 5, 'Cardápio/menu disponível e correto', 'Sem itens em falta ou desatualizados.', false);
  END IF;
  IF v_sector IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.checklist_templates WHERE slug='fechamento-bar') THEN
    INSERT INTO public.checklist_templates (sector_id, name, slug, description, kind, is_active, sort_order, schedule_days)
    VALUES (v_sector, 'Fechamento do Bar', 'fechamento-bar', 'Encerramento e higienização do bar.', 'operacional', true, 20, ARRAY[1,2,3,4,5,6,0])
    RETURNING id INTO v_tpl;
    INSERT INTO public.checklist_items (template_id, position, title, guidance, is_critical) VALUES
      (v_tpl, 1, 'Bancadas higienizadas', 'Retirar todo resíduo.', true),
      (v_tpl, 2, 'Bebidas armazenadas corretamente', 'Sob refrigeração adequada.', false),
      (v_tpl, 3, 'Lixo retirado', 'Área sem odores.', false),
      (v_tpl, 4, 'Equipamentos desligados', 'Blender, freezer e outros.', true);
  END IF;

  SELECT id INTO v_sector FROM public.sectors WHERE slug='confeitaria';
  IF v_sector IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.checklist_templates WHERE slug='rotina-confeitaria') THEN
    INSERT INTO public.checklist_templates (sector_id, name, slug, description, kind, is_active, sort_order, schedule_days)
    VALUES (v_sector, 'Rotina da Confeitaria', 'rotina-confeitaria', 'Boas práticas e organização diária da confeitaria.', 'operacional', true, 10, ARRAY[1,2,3,4,5,6])
    RETURNING id INTO v_tpl;
    INSERT INTO public.checklist_items (template_id, position, title, guidance, is_critical) VALUES
      (v_tpl, 1, 'Bancadas e utensílios sanitizados', 'Antes de iniciar produção.', true),
      (v_tpl, 2, 'Temperatura de refrigeradores conferida', 'Registrar temperatura.', true),
      (v_tpl, 3, 'Insumos identificados e dentro do prazo', 'Etiquetagem completa.', true),
      (v_tpl, 4, 'Produtos finalizados sob refrigeração adequada', 'Cobertos e etiquetados.', false),
      (v_tpl, 5, 'Uso correto de EPIs (touca, luvas)', 'Toda a equipe.', true);
  END IF;

  SELECT id INTO v_sector FROM public.sectors WHERE slug='banheiros';
  IF v_sector IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.checklist_templates WHERE slug='higienizacao-banheiros') THEN
    INSERT INTO public.checklist_templates (sector_id, name, slug, description, kind, is_active, sort_order, schedule_days)
    VALUES (v_sector, 'Higienização dos Banheiros', 'higienizacao-banheiros', 'Verificação de limpeza, insumos e conservação dos banheiros.', 'operacional', true, 10, ARRAY[1,2,3,4,5,6,0])
    RETURNING id INTO v_tpl;
    INSERT INTO public.checklist_items (template_id, position, title, guidance, is_critical) VALUES
      (v_tpl, 1, 'Pisos e paredes limpos', 'Sem manchas ou resíduos.', true),
      (v_tpl, 2, 'Vasos e mictórios higienizados', 'Com produto adequado.', true),
      (v_tpl, 3, 'Papel higiênico e toalha disponíveis', 'Reposição imediata se faltar.', false),
      (v_tpl, 4, 'Sabonete líquido no dispenser', 'Sempre abastecido.', true),
      (v_tpl, 5, 'Lixeiras esvaziadas', 'Trocar sacos.', false),
      (v_tpl, 6, 'Espelhos e metais sem manchas', 'Aparência impecável.', false),
      (v_tpl, 7, 'Ambiente com aroma agradável', 'Sem odores desagradáveis.', false);
  END IF;
END $mig$;

DO $mig$
DECLARE v_area uuid; v_qsector uuid;
BEGIN
  SELECT id INTO v_area FROM public.quality_areas WHERE slug='delivery';
  IF v_area IS NULL THEN
    INSERT INTO public.quality_areas (name, slug, target_score, position, is_active)
    VALUES ('Delivery', 'delivery', 90, 60, true)
    RETURNING id INTO v_area;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.quality_sectors WHERE slug='delivery-geral') THEN
    INSERT INTO public.quality_sectors (area_id, name, slug, position, is_active, target_score)
    VALUES (v_area, 'Operação de Delivery', 'delivery-geral', 1, true, 90)
    RETURNING id INTO v_qsector;

    INSERT INTO public.quality_items (sector_id, title, guidance, weight, is_critical, requires_photo, position, is_active) VALUES
      (v_qsector, 'Embalagens íntegras e adequadas', 'Sem vazamentos, tampas firmes, isolamento térmico correto.', 1.0, true, false, 1, true),
      (v_qsector, 'Tempo de preparo dentro da meta', 'Pedido finalizado no tempo padrão do restaurante.', 1.0, false, false, 2, true),
      (v_qsector, 'Temperatura de saída correta', 'Quente >60°C, frio <5°C.', 1.5, true, false, 3, true),
      (v_qsector, 'Conferência do pedido antes do envio', 'Todos os itens e adicionais presentes.', 1.0, true, false, 4, true),
      (v_qsector, 'Etiqueta com pedido, cliente e horário', 'Identificação completa e legível.', 0.5, false, false, 5, true),
      (v_qsector, 'Higiene do entregador e mochila térmica', 'Uniforme limpo, mochila higienizada.', 1.0, true, true, 6, true),
      (v_qsector, 'Cardápio/preços atualizados nos apps', 'Sem itens indisponíveis marcados como disponíveis.', 0.5, false, false, 7, true),
      (v_qsector, 'Avaliações recentes monitoradas', 'Respostas dadas a reclamações do período.', 0.5, false, false, 8, true);
  END IF;
END $mig$;