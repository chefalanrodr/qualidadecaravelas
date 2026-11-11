-- Quality audit seed based on the NOM PDF sent on 2026-07-18.
-- Previous quality structures are kept for history, but deactivated for new audits.

DO $quality_pdf_seed$
DECLARE
  v_area uuid;
  v_sector uuid;
BEGIN
  UPDATE public.quality_areas
  SET is_active = false;

  INSERT INTO public.quality_areas (name, slug, target_score, position, is_active)
  VALUES ('Raiz cozinha brasileira', 'raiz-cozinha-brasileira', 90, 1, true)
  ON CONFLICT (slug) DO UPDATE
  SET name = EXCLUDED.name,
      target_score = EXCLUDED.target_score,
      position = EXCLUDED.position,
      is_active = true
  RETURNING id INTO v_area;

  UPDATE public.quality_sectors
  SET is_active = false
  WHERE area_id = v_area;

  INSERT INTO public.quality_sectors (area_id, name, slug, position, is_active, target_score)
  VALUES (v_area, 'HIGINE DE PANELAS', 'higine-de-panelas', 1, true, 90)
  ON CONFLICT (area_id, slug) DO UPDATE
  SET name = EXCLUDED.name,
      position = EXCLUDED.position,
      is_active = true,
      target_score = EXCLUDED.target_score
  RETURNING id INTO v_sector;

  UPDATE public.quality_items
  SET is_active = false
  WHERE sector_id = v_sector;

  INSERT INTO public.quality_items (sector_id, title, weight, is_critical, requires_photo, position, is_active) VALUES
    (v_sector, 'Teto', 1, false, false, 1, true),
    (v_sector, 'Paredes', 1, false, false, 2, true),
    (v_sector, 'Luminárias', 1, false, false, 3, true),
    (v_sector, 'Piso', 1, false, false, 4, true),
    (v_sector, 'Ralo', 1, false, false, 5, true),
    (v_sector, 'Prateleiras de Utensílios', 1, false, false, 6, true),
    (v_sector, 'Bancada com Pia Dupla', 1, false, false, 7, true),
    (v_sector, 'Pias Limpas', 1, false, false, 8, true),
    (v_sector, 'Papel Toalha Abastecido', 2, false, false, 9, true),
    (v_sector, 'Estante de Utensílios Preta', 1, false, false, 10, true),
    (v_sector, 'Local da Gordura', 1, false, false, 11, true),
    (v_sector, 'Estrados', 1, false, false, 12, true),
    (v_sector, 'Lixeiras', 1, false, false, 13, true),
    (v_sector, 'Utensílios Limpos', 1, false, false, 14, true),
    (v_sector, 'Ausência de Caixa de Papelão', 2, false, false, 15, true),
    (v_sector, 'Ausência de Saco Reciclado', 2, false, false, 16, true),
    (v_sector, 'Funcionários sem Adornos', 2, false, false, 17, true),
    (v_sector, 'Higiene Pessoal Adequada', 2, false, false, 18, true),
    (v_sector, 'Ausência de Objeto Pessoais', 2, false, false, 19, true),
    (v_sector, 'Uniforme Completo', 2, false, false, 20, true),
    (v_sector, 'Uniforme Limpo', 2, false, false, 21, true),
    (v_sector, 'Sem Barba', 2, false, false, 22, true),
    (v_sector, 'Unhas Curtas e sem Esmalte', 2, false, false, 23, true),
    (v_sector, 'Ausência de Cílios Postiços', 2, false, false, 24, true),
    (v_sector, 'Planilha - Higiene de Equipamentos', 2, false, false, 25, true);

  INSERT INTO public.quality_sectors (area_id, name, slug, position, is_active, target_score)
  VALUES (v_area, 'CÂMARA DE MATURAÇÃO DE PEIXES', 'camara-de-maturacao-de-peixes', 2, true, 90)
  ON CONFLICT (area_id, slug) DO UPDATE
  SET name = EXCLUDED.name,
      position = EXCLUDED.position,
      is_active = true,
      target_score = EXCLUDED.target_score
  RETURNING id INTO v_sector;

  UPDATE public.quality_items
  SET is_active = false
  WHERE sector_id = v_sector;

  INSERT INTO public.quality_items (sector_id, title, weight, is_critical, requires_photo, position, is_active) VALUES
    (v_sector, 'Teto', 1, false, false, 1, true),
    (v_sector, 'Paredes', 1, false, false, 2, true),
    (v_sector, 'Luminárias', 1, false, false, 3, true),
    (v_sector, 'Piso', 1, false, false, 4, true),
    (v_sector, 'Ralo Externo', 1, false, false, 5, true),
    (v_sector, 'Porta', 1, false, false, 6, true),
    (v_sector, 'Suporte de Inox', 1, false, false, 7, true),
    (v_sector, 'Gangos', 1, false, false, 8, true),
    (v_sector, 'Vidro', 1, false, false, 9, true),
    (v_sector, 'Utensílios Limpos', 1, false, false, 10, true),
    (v_sector, 'Planilha - Higiene e Temperatura dos Equipamentos', 2, false, false, 11, true);

  INSERT INTO public.quality_sectors (area_id, name, slug, position, is_active, target_score)
  VALUES (v_area, 'BAR', 'bar', 3, true, 90)
  ON CONFLICT (area_id, slug) DO UPDATE
  SET name = EXCLUDED.name,
      position = EXCLUDED.position,
      is_active = true,
      target_score = EXCLUDED.target_score
  RETURNING id INTO v_sector;

  UPDATE public.quality_items
  SET is_active = false
  WHERE sector_id = v_sector;

  INSERT INTO public.quality_items (sector_id, title, weight, is_critical, requires_photo, position, is_active) VALUES
    (v_sector, 'Paredes', 1, false, false, 1, true),
    (v_sector, 'Luminárias', 1, false, false, 2, true),
    (v_sector, 'Piso', 1, false, false, 3, true),
    (v_sector, 'Ralo', 1, false, false, 4, true),
    (v_sector, 'Bancada de Pedidos', 1, false, false, 5, true),
    (v_sector, 'Estufas de Xícaras', 1, false, false, 6, true),
    (v_sector, 'Cafeteiras', 1, false, false, 7, true),
    (v_sector, 'Calhas da Estação 1', 1, false, false, 8, true),
    (v_sector, 'Refrigerador do Beck Bar 1', 1, false, false, 9, true),
    (v_sector, 'Estação 1', 1, false, false, 10, true),
    (v_sector, 'Cuba de Gelo da Estação 1', 1, false, false, 11, true),
    (v_sector, 'Pia Limpa da Estação 1', 1, false, false, 12, true),
    (v_sector, 'Refrigerador da Estação 1', 1, false, false, 13, true),
    (v_sector, 'Lixeira da Estação 1', 1, false, false, 14, true),
    (v_sector, 'Gavetas de Inox', 1, false, false, 15, true),
    (v_sector, 'Ultracongelador', 1, false, false, 16, true),
    (v_sector, 'Calhas da Estação 2', 1, false, false, 17, true),
    (v_sector, 'Refrigerador do Beck Bar 2', 1, false, false, 18, true),
    (v_sector, 'Estação 2', 1, false, false, 19, true),
    (v_sector, 'Cuba de Gelo da Estação 2', 1, false, false, 20, true),
    (v_sector, 'Pia Limpa da Estação 2', 1, false, false, 21, true),
    (v_sector, 'Refrigerador da Estação 2', 1, false, false, 22, true),
    (v_sector, 'Prateleiras Decorativas', 1, false, false, 23, true),
    (v_sector, 'Vidro Externo da Câmara', 1, false, false, 24, true),
    (v_sector, 'Refrigerador Devassa / Corredor', 1, false, false, 25, true),
    (v_sector, 'Máquina de Gelo / Corredor', 1, false, false, 26, true),
    (v_sector, 'Refrigerador Coca Cola / Corredor', 1, false, false, 27, true),
    (v_sector, 'Refrigerador Heineken / Corredor', 1, false, false, 28, true),
    (v_sector, 'Utensílios Limpos', 1, false, false, 29, true),
    (v_sector, 'Ausência de Caixa de Papelão', 2, false, false, 30, true),
    (v_sector, 'Alimentos com Etiqueta', 2, false, false, 31, true),
    (v_sector, 'Alimentos sem Contato com o Chão', 2, false, false, 32, true),
    (v_sector, 'Alimentos em Boas Condições Sensoriais', 2, false, false, 33, true),
    (v_sector, 'Alimentos Protegidos', 2, false, false, 34, true),
    (v_sector, 'Alimentos com PVPS', 2, false, false, 35, true),
    (v_sector, 'Ausência de Saco Reciclado', 2, false, false, 36, true),
    (v_sector, 'Alimentos em Temperatura Adequada', 2, false, false, 37, true),
    (v_sector, 'Ausência de Alimentos Vencidos', 3, false, false, 38, true),
    (v_sector, 'Funcionários sem Adornos', 2, false, false, 39, true),
    (v_sector, 'Higiene Pessoal Adequada', 2, false, false, 40, true),
    (v_sector, 'Ausência de Objeto Pessoais', 2, false, false, 41, true),
    (v_sector, 'Uniforme Completo', 2, false, false, 42, true),
    (v_sector, 'Uniforme Limpo', 2, false, false, 43, true),
    (v_sector, 'Sem Barba', 2, false, false, 44, true),
    (v_sector, 'Unhas Curtas e sem Esmalte', 2, false, false, 45, true),
    (v_sector, 'Ausência de Cílios Postiços', 2, false, false, 46, true),
    (v_sector, 'Pia de Mãos Limpa', 2, false, false, 47, true),
    (v_sector, 'Papel Toalha Abastecido', 2, false, false, 48, true),
    (v_sector, 'Sabonete Bactericida Abastecido', 2, false, false, 49, true),
    (v_sector, 'Lixeira com Pedal - Pia de Mãos', 2, false, false, 50, true),
    (v_sector, 'Planilha - Higiene de Equipamentos', 2, false, false, 51, true),
    (v_sector, 'Planilha - Higiene de Hortifrutis', 2, false, false, 52, true),
    (v_sector, 'Planilha - Higiene de Latinhas', 2, false, false, 53, true);

  INSERT INTO public.quality_sectors (area_id, name, slug, position, is_active, target_score)
  VALUES (v_area, 'CÂMARA REFRIGERADA', 'camara-refrigerada', 4, true, 90)
  ON CONFLICT (area_id, slug) DO UPDATE
  SET name = EXCLUDED.name,
      position = EXCLUDED.position,
      is_active = true,
      target_score = EXCLUDED.target_score
  RETURNING id INTO v_sector;

  UPDATE public.quality_items
  SET is_active = false
  WHERE sector_id = v_sector;

  INSERT INTO public.quality_items (sector_id, title, weight, is_critical, requires_photo, position, is_active) VALUES
    (v_sector, 'Teto', 1, false, false, 1, true),
    (v_sector, 'Paredes', 1, false, false, 2, true),
    (v_sector, 'Luminárias', 1, false, false, 3, true),
    (v_sector, 'Piso', 1, false, false, 4, true),
    (v_sector, 'Ralo Externo', 1, false, false, 5, true),
    (v_sector, 'Porta', 1, false, false, 6, true),
    (v_sector, 'Estantes', 1, false, false, 7, true),
    (v_sector, 'Estrados', 1, false, false, 8, true),
    (v_sector, 'Caixas Plásticas', 1, false, false, 9, true),
    (v_sector, 'Utensílios Limpos', 1, false, false, 10, true),
    (v_sector, 'Ausência de Caixa de Papelão', 2, false, false, 11, true),
    (v_sector, 'Alimentos com Etiqueta', 2, false, false, 12, true),
    (v_sector, 'Alimentos sem Contato com o Chão', 2, false, false, 13, true),
    (v_sector, 'Alimentos em Boas Condições Sensoriais', 2, false, false, 14, true),
    (v_sector, 'Alimentos Protegidos', 2, false, false, 15, true),
    (v_sector, 'Alimentos com PVPS', 2, false, false, 16, true),
    (v_sector, 'Ausência de Saco Reciclado', 2, false, false, 17, true),
    (v_sector, 'Alimentos em Temperatura Adequada', 2, false, false, 18, true),
    (v_sector, 'Ausência de Alimentos Vencidos', 3, false, false, 19, true),
    (v_sector, 'Funcionários sem Adornos', 2, false, false, 20, true),
    (v_sector, 'Higiene Pessoal Adequada', 2, false, false, 21, true),
    (v_sector, 'Ausência de Objeto Pessoais', 2, false, false, 22, true),
    (v_sector, 'Uniforme Completo', 2, false, false, 23, true),
    (v_sector, 'Uniforme Limpo', 2, false, false, 24, true),
    (v_sector, 'Sem Barba', 2, false, false, 25, true),
    (v_sector, 'Unhas Curtas e sem Esmalte', 2, false, false, 26, true),
    (v_sector, 'Ausência de Cílios Postiços', 2, false, false, 27, true);
END $quality_pdf_seed$;
