-- Reset quality audit structure and recreate it from the NOM PDF.
-- The PDF has one restaurant/setor context and four evaluated areas with 116 weighted questions.

DO $quality_pdf_reset$
DECLARE
  v_setor_id uuid;
BEGIN
  -- Clear the old quality structure. Cascades remove old sectors, items and quality answer rows tied to those items.
  DELETE FROM public.quality_audit_answers;
  DELETE FROM public.quality_audit_sectors;
  DELETE FROM public.quality_areas;

  INSERT INTO public.quality_areas (name, slug, target_score, position, is_active)
  VALUES ('Raiz cozinha brasileira', 'raiz-cozinha-brasileira', 90, 1, true)
  RETURNING id INTO v_setor_id;

  INSERT INTO public.quality_sectors (area_id, name, slug, position, target_score, is_active)
  SELECT v_setor_id, name, slug, position, 90, true
  FROM (VALUES
    ('HIGINE DE PANELAS', 'higine-de-panelas', 1),
    ('CÂMARA DE MATURAÇÃO DE PEIXES', 'camara-de-maturacao-de-peixes', 2),
    ('BAR', 'bar', 3),
    ('CÂMARA REFRIGERADA', 'camara-refrigerada', 4)
  ) AS area_seed(name, slug, position);

  INSERT INTO public.quality_items (sector_id, title, weight, is_critical, requires_photo, position, is_active)
  SELECT s.id, item_seed.title, item_seed.weight, false, false, item_seed.position, true
  FROM (VALUES
    ('higine-de-panelas', 'Teto', 1, 1),
    ('higine-de-panelas', 'Paredes', 1, 2),
    ('higine-de-panelas', 'Luminárias', 1, 3),
    ('higine-de-panelas', 'Piso', 1, 4),
    ('higine-de-panelas', 'Ralo', 1, 5),
    ('higine-de-panelas', 'Prateleiras de Utensílios', 1, 6),
    ('higine-de-panelas', 'Bancada com Pia Dupla', 1, 7),
    ('higine-de-panelas', 'Pias Limpas', 1, 8),
    ('higine-de-panelas', 'Papel Toalha Abastecido', 2, 9),
    ('higine-de-panelas', 'Estante de Utensílios Preta', 1, 10),
    ('higine-de-panelas', 'Local da Gordura', 1, 11),
    ('higine-de-panelas', 'Estrados', 1, 12),
    ('higine-de-panelas', 'Lixeiras', 1, 13),
    ('higine-de-panelas', 'Utensílios Limpos', 1, 14),
    ('higine-de-panelas', 'Ausência de Caixa de Papelão', 2, 15),
    ('higine-de-panelas', 'Ausência de Saco Reciclado', 2, 16),
    ('higine-de-panelas', 'Funcionários sem Adornos', 2, 17),
    ('higine-de-panelas', 'Higiene Pessoal Adequada', 2, 18),
    ('higine-de-panelas', 'Ausência de Objeto Pessoais', 2, 19),
    ('higine-de-panelas', 'Uniforme Completo', 2, 20),
    ('higine-de-panelas', 'Uniforme Limpo', 2, 21),
    ('higine-de-panelas', 'Sem Barba', 2, 22),
    ('higine-de-panelas', 'Unhas Curtas e sem Esmalte', 2, 23),
    ('higine-de-panelas', 'Ausência de Cílios Postiços', 2, 24),
    ('higine-de-panelas', 'Planilha - Higiene de Equipamentos', 2, 25),

    ('camara-de-maturacao-de-peixes', 'Teto', 1, 1),
    ('camara-de-maturacao-de-peixes', 'Paredes', 1, 2),
    ('camara-de-maturacao-de-peixes', 'Luminárias', 1, 3),
    ('camara-de-maturacao-de-peixes', 'Piso', 1, 4),
    ('camara-de-maturacao-de-peixes', 'Ralo Externo', 1, 5),
    ('camara-de-maturacao-de-peixes', 'Porta', 1, 6),
    ('camara-de-maturacao-de-peixes', 'Suporte de Inox', 1, 7),
    ('camara-de-maturacao-de-peixes', 'Gangos', 1, 8),
    ('camara-de-maturacao-de-peixes', 'Vidro', 1, 9),
    ('camara-de-maturacao-de-peixes', 'Utensílios Limpos', 1, 10),
    ('camara-de-maturacao-de-peixes', 'Planilha - Higiene e Temperatura dos Equipamentos', 2, 11),

    ('bar', 'Paredes', 1, 1),
    ('bar', 'Luminárias', 1, 2),
    ('bar', 'Piso', 1, 3),
    ('bar', 'Ralo', 1, 4),
    ('bar', 'Bancada de Pedidos', 1, 5),
    ('bar', 'Estufas de Xícaras', 1, 6),
    ('bar', 'Cafeteiras', 1, 7),
    ('bar', 'Calhas da Estação 1', 1, 8),
    ('bar', 'Refrigerador do Beck Bar 1', 1, 9),
    ('bar', 'Estação 1', 1, 10),
    ('bar', 'Cuba de Gelo da Estação 1', 1, 11),
    ('bar', 'Pia Limpa da Estação 1', 1, 12),
    ('bar', 'Refrigerador da Estação 1', 1, 13),
    ('bar', 'Lixeira da Estação 1', 1, 14),
    ('bar', 'Gavetas de Inox', 1, 15),
    ('bar', 'Ultracongelador', 1, 16),
    ('bar', 'Calhas da Estação 2', 1, 17),
    ('bar', 'Refrigerador do Beck Bar 2', 1, 18),
    ('bar', 'Estação 2', 1, 19),
    ('bar', 'Cuba de Gelo da Estação 2', 1, 20),
    ('bar', 'Pia Limpa da Estação 2', 1, 21),
    ('bar', 'Refrigerador da Estação 2', 1, 22),
    ('bar', 'Prateleiras Decorativas', 1, 23),
    ('bar', 'Vidro Externo da Câmara', 1, 24),
    ('bar', 'Refrigerador Devassa / Corredor', 1, 25),
    ('bar', 'Máquina de Gelo / Corredor', 1, 26),
    ('bar', 'Refrigerador Coca Cola / Corredor', 1, 27),
    ('bar', 'Refrigerador Heineken / Corredor', 1, 28),
    ('bar', 'Utensílios Limpos', 1, 29),
    ('bar', 'Ausência de Caixa de Papelão', 2, 30),
    ('bar', 'Alimentos com Etiqueta', 2, 31),
    ('bar', 'Alimentos sem Contato com o Chão', 2, 32),
    ('bar', 'Alimentos em Boas Condições Sensoriais', 2, 33),
    ('bar', 'Alimentos Protegidos', 2, 34),
    ('bar', 'Alimentos com PVPS', 2, 35),
    ('bar', 'Ausência de Saco Reciclado', 2, 36),
    ('bar', 'Alimentos em Temperatura Adequada', 2, 37),
    ('bar', 'Ausência de Alimentos Vencidos', 3, 38),
    ('bar', 'Funcionários sem Adornos', 2, 39),
    ('bar', 'Higiene Pessoal Adequada', 2, 40),
    ('bar', 'Ausência de Objeto Pessoais', 2, 41),
    ('bar', 'Uniforme Completo', 2, 42),
    ('bar', 'Uniforme Limpo', 2, 43),
    ('bar', 'Sem Barba', 2, 44),
    ('bar', 'Unhas Curtas e sem Esmalte', 2, 45),
    ('bar', 'Ausência de Cílios Postiços', 2, 46),
    ('bar', 'Pia de Mãos Limpa', 2, 47),
    ('bar', 'Papel Toalha Abastecido', 2, 48),
    ('bar', 'Sabonete Bactericida Abastecido', 2, 49),
    ('bar', 'Lixeira com Pedal - Pia de Mãos', 2, 50),
    ('bar', 'Planilha - Higiene de Equipamentos', 2, 51),
    ('bar', 'Planilha - Higiene de Hortifrutis', 2, 52),
    ('bar', 'Planilha - Higiene de Latinhas', 2, 53),

    ('camara-refrigerada', 'Teto', 1, 1),
    ('camara-refrigerada', 'Paredes', 1, 2),
    ('camara-refrigerada', 'Luminárias', 1, 3),
    ('camara-refrigerada', 'Piso', 1, 4),
    ('camara-refrigerada', 'Ralo Externo', 1, 5),
    ('camara-refrigerada', 'Porta', 1, 6),
    ('camara-refrigerada', 'Estantes', 1, 7),
    ('camara-refrigerada', 'Estrados', 1, 8),
    ('camara-refrigerada', 'Caixas Plásticas', 1, 9),
    ('camara-refrigerada', 'Utensílios Limpos', 1, 10),
    ('camara-refrigerada', 'Ausência de Caixa de Papelão', 2, 11),
    ('camara-refrigerada', 'Alimentos com Etiqueta', 2, 12),
    ('camara-refrigerada', 'Alimentos sem Contato com o Chão', 2, 13),
    ('camara-refrigerada', 'Alimentos em Boas Condições Sensoriais', 2, 14),
    ('camara-refrigerada', 'Alimentos Protegidos', 2, 15),
    ('camara-refrigerada', 'Alimentos com PVPS', 2, 16),
    ('camara-refrigerada', 'Ausência de Saco Reciclado', 2, 17),
    ('camara-refrigerada', 'Alimentos em Temperatura Adequada', 2, 18),
    ('camara-refrigerada', 'Ausência de Alimentos Vencidos', 3, 19),
    ('camara-refrigerada', 'Funcionários sem Adornos', 2, 20),
    ('camara-refrigerada', 'Higiene Pessoal Adequada', 2, 21),
    ('camara-refrigerada', 'Ausência de Objeto Pessoais', 2, 22),
    ('camara-refrigerada', 'Uniforme Completo', 2, 23),
    ('camara-refrigerada', 'Uniforme Limpo', 2, 24),
    ('camara-refrigerada', 'Sem Barba', 2, 25),
    ('camara-refrigerada', 'Unhas Curtas e sem Esmalte', 2, 26),
    ('camara-refrigerada', 'Ausência de Cílios Postiços', 2, 27)
  ) AS item_seed(area_slug, title, weight, position)
  JOIN public.quality_sectors s
    ON s.area_id = v_setor_id
   AND s.slug = item_seed.area_slug;
END $quality_pdf_reset$;
