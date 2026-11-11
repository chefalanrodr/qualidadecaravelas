
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'auditor', 'visualizador');
CREATE TYPE public.item_priority AS ENUM ('critico', 'alto', 'medio', 'baixo');
CREATE TYPE public.answer_status AS ENUM ('conforme', 'nao_conforme', 'nao_aplicavel');
CREATE TYPE public.execution_status AS ENUM ('nao_iniciado','em_andamento','concluido','concluido_com_atraso','nao_realizado','cancelado');
CREATE TYPE public.action_status AS ENUM ('aberto','em_andamento','aguardando_validacao','concluido','vencido','cancelado');
CREATE TYPE public.checklist_kind AS ENUM ('operacional','auditoria');

-- ============ UPDATED_AT HELPER ============
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  role_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles select self or admin" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles update self" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles insert self" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles select self" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "roles select admin" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "roles manage admin" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Auto-create profile and role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'auditor') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ SECTORS ============
CREATE TABLE public.sectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sectors TO authenticated;
GRANT ALL ON public.sectors TO service_role;
ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sectors read all auth" ON public.sectors FOR SELECT TO authenticated USING (true);
CREATE POLICY "sectors admin write" ON public.sectors FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER sectors_updated_at BEFORE UPDATE ON public.sectors FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ AREAS ============
CREATE TABLE public.areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id UUID NOT NULL REFERENCES public.sectors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(sector_id, name)
);
GRANT SELECT ON public.areas TO authenticated;
GRANT ALL ON public.areas TO service_role;
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "areas read all auth" ON public.areas FOR SELECT TO authenticated USING (true);
CREATE POLICY "areas admin write" ON public.areas FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER areas_updated_at BEFORE UPDATE ON public.areas FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ CHECKLIST TEMPLATES ============
CREATE TABLE public.checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id UUID REFERENCES public.sectors(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  kind public.checklist_kind NOT NULL DEFAULT 'operacional',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.checklist_templates TO authenticated;
GRANT ALL ON public.checklist_templates TO service_role;
ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "templates read all auth" ON public.checklist_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "templates admin write" ON public.checklist_templates FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER templates_updated_at BEFORE UPDATE ON public.checklist_templates FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ CHECKLIST ITEMS ============
CREATE TABLE public.checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
  position INT NOT NULL,
  title TEXT NOT NULL,
  guidance TEXT,
  priority public.item_priority NOT NULL DEFAULT 'medio',
  is_critical BOOLEAN NOT NULL DEFAULT false,
  weight INT NOT NULL DEFAULT 2,
  requires_photo_on_conforme BOOLEAN NOT NULL DEFAULT false,
  sub_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.checklist_items(template_id, position);
GRANT SELECT ON public.checklist_items TO authenticated;
GRANT ALL ON public.checklist_items TO service_role;
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "items read all auth" ON public.checklist_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "items admin write" ON public.checklist_items FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER items_updated_at BEFORE UPDATE ON public.checklist_items FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ CHECKLIST EXECUTIONS ============
CREATE TABLE public.checklist_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.checklist_templates(id) ON DELETE RESTRICT,
  area_id UUID REFERENCES public.areas(id) ON DELETE SET NULL,
  auditor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  status public.execution_status NOT NULL DEFAULT 'em_andamento',
  score NUMERIC(5,2),
  turno TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.checklist_executions(auditor_id, started_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.checklist_executions TO authenticated;
GRANT ALL ON public.checklist_executions TO service_role;
ALTER TABLE public.checklist_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exec read own or admin/visu" ON public.checklist_executions FOR SELECT TO authenticated
USING (auditor_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'visualizador'));
CREATE POLICY "exec insert auditor/admin" ON public.checklist_executions FOR INSERT TO authenticated
WITH CHECK (auditor_id = auth.uid() AND (public.has_role(auth.uid(),'auditor') OR public.has_role(auth.uid(),'admin')));
CREATE POLICY "exec update own or admin" ON public.checklist_executions FOR UPDATE TO authenticated
USING (auditor_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
WITH CHECK (auditor_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER exec_updated_at BEFORE UPDATE ON public.checklist_executions FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ CHECKLIST ANSWERS ============
CREATE TABLE public.checklist_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES public.checklist_executions(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.checklist_items(id) ON DELETE RESTRICT,
  status public.answer_status,
  observation TEXT,
  justification TEXT,
  sub_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  answered_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(execution_id, item_id)
);
CREATE INDEX ON public.checklist_answers(execution_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_answers TO authenticated;
GRANT ALL ON public.checklist_answers TO service_role;
ALTER TABLE public.checklist_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "answers via execution" ON public.checklist_answers FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.checklist_executions e WHERE e.id = execution_id
  AND (e.auditor_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'visualizador'))))
WITH CHECK (EXISTS (SELECT 1 FROM public.checklist_executions e WHERE e.id = execution_id
  AND (e.auditor_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));
CREATE TRIGGER answers_updated_at BEFORE UPDATE ON public.checklist_answers FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ ATTACHMENTS ============
CREATE TABLE public.attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  answer_id UUID REFERENCES public.checklist_answers(id) ON DELETE CASCADE,
  action_plan_id UUID,
  storage_path TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'photo',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.attachments TO authenticated;
GRANT ALL ON public.attachments TO service_role;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attachments read auth" ON public.attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY "attachments insert own" ON public.attachments FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "attachments delete own or admin" ON public.attachments FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- ============ ACTION PLANS ============
CREATE TABLE public.action_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  answer_id UUID REFERENCES public.checklist_answers(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  responsible TEXT,
  responsible_user_id UUID REFERENCES auth.users(id),
  due_date DATE,
  priority public.item_priority,
  status public.action_status NOT NULL DEFAULT 'aberto',
  solution TEXT,
  corrected_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.action_plans TO authenticated;
GRANT ALL ON public.action_plans TO service_role;
ALTER TABLE public.action_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans read auth" ON public.action_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "plans insert auth" ON public.action_plans FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "plans update own or admin" ON public.action_plans FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR responsible_user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER plans_updated_at BEFORE UPDATE ON public.action_plans FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ RESTAURANT SETTINGS ============
CREATE TABLE public.restaurant_settings (
  id INT PRIMARY KEY DEFAULT 1,
  name TEXT NOT NULL DEFAULT 'Meu Restaurante',
  logo_url TEXT,
  score_bands JSONB NOT NULL DEFAULT '{"excelente":90,"bom":80,"atencao":70}'::jsonb,
  temp_refrig_max NUMERIC DEFAULT 4,
  temp_freezer_max NUMERIC DEFAULT -18,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);
GRANT SELECT ON public.restaurant_settings TO authenticated;
GRANT ALL ON public.restaurant_settings TO service_role;
ALTER TABLE public.restaurant_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings read auth" ON public.restaurant_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings admin write" ON public.restaurant_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.restaurant_settings (id, name) VALUES (1, 'Meu Restaurante') ON CONFLICT DO NOTHING;

-- ============ SEED SECTORS ============
INSERT INTO public.sectors (name, slug, sort_order) VALUES
  ('Cozinha','cozinha',1),
  ('Salão','salao',2),
  ('Bar','bar',3),
  ('Staff','staff',4),
  ('Almoxarifado','almoxarifado',5),
  ('Delivery','delivery',6);

-- ============ SEED AREAS ============
WITH s AS (SELECT id, slug FROM public.sectors)
INSERT INTO public.areas (sector_id, name, sort_order)
SELECT s.id, a.name, a.ord FROM s JOIN (VALUES
  ('cozinha','Proteínas',1),('cozinha','Guarnições',2),('cozinha','Fritadeira',3),('cozinha','Finalizações',4),
  ('cozinha','Sobremesas',5),('cozinha','Produção Quente',6),('cozinha','Porcionamento',7),('cozinha','Garde Manger',8),('cozinha','Confeitaria',9),
  ('salao','Salão Principal',1),('salao','Salão Bar',2),('salao','Salão Climatizado',3),('salao','Área Kids',4),('salao','Banheiros de Clientes',5),('salao','Área de Expedição',6),
  ('bar','Bar Principal',1),('bar','Barback',2),
  ('staff','Banheiros de Funcionários',1),('staff','Casinha do Lixo',2),('staff','Corredores Comuns',3),
  ('almoxarifado','Estoque Seco',1),('almoxarifado','Câmaras Frias',2),('almoxarifado','Estoque de Bebidas',3),
  ('delivery','Área de Expedição',1),('delivery','Montagem',2),('delivery','Embalagem',3),('delivery','Retirada de Pedidos',4)
) AS a(sector_slug, name, ord) ON s.slug = a.sector_slug;

-- ============ SEED TEMPLATES + ITEMS (Cozinha) ============
DO $seed$
DECLARE
  cozinha_id UUID;
  salao_id UUID;
  abertura_id UUID;
  fechamento_id UUID;
  enc_salao_id UUID;
BEGIN
  SELECT id INTO cozinha_id FROM public.sectors WHERE slug = 'cozinha';
  SELECT id INTO salao_id FROM public.sectors WHERE slug = 'salao';

  INSERT INTO public.checklist_templates (sector_id, name, slug, description, kind, sort_order)
  VALUES (cozinha_id, 'Abertura da Cozinha', 'abertura-cozinha',
    'Checklist para garantir a abertura segura e correta da cozinha.', 'operacional', 1)
  RETURNING id INTO abertura_id;

  INSERT INTO public.checklist_templates (sector_id, name, slug, description, kind, sort_order)
  VALUES (cozinha_id, 'Fechamento da Cozinha', 'fechamento-cozinha',
    'Checklist para garantir o encerramento seguro, limpo e organizado da operação.', 'operacional', 2)
  RETURNING id INTO fechamento_id;

  INSERT INTO public.checklist_items (template_id, position, title, guidance, priority, is_critical, weight) VALUES
  (abertura_id, 1, 'Ligar o sistema geral de gás', 'Abra o registro geral e confirme que não há cheiro de gás ou sinais de vazamento.', 'critico', true, 4),
  (abertura_id, 2, 'Ligar KDS, computadores e impressoras', 'Ligue as telas de produção, computadores, impressoras e demais equipamentos de despacho.', 'alto', false, 3),
  (abertura_id, 3, 'Verificar estoque das praças', 'Confira os estoques de cada praça e identifique necessidades de requisição ou reposição.', 'alto', false, 3),
  (abertura_id, 4, 'Informar rupturas de produtos', 'Registre e comunique ao salão e ao delivery os produtos indisponíveis ou com estoque crítico.', 'alto', false, 3),
  (abertura_id, 5, 'Verificar limpeza geral', 'Inspecione pisos, paredes, bancadas, equipamentos, refrigeradores, freezers e áreas de circulação.', 'alto', false, 3),
  (abertura_id, 6, 'Conferir funcionamento de fogões e fornos', 'Teste queimadores, chapas e fornos. Verifique se a chama está estável e com coloração adequada.', 'critico', true, 4),
  (abertura_id, 7, 'Testar exaustão e ventilação', 'Ligue coifas e exaustores. Confirme o funcionamento e verifique a condição aparente dos filtros.', 'critico', true, 4),
  (abertura_id, 8, 'Testar telas de despacho e impressoras', 'Realize um teste de impressão e confirme se os pedidos estão sendo enviados corretamente aos setores.', 'medio', false, 2),
  (abertura_id, 9, 'Verificar pressão ou nível do gás', 'Confirme se há gás suficiente para o período de operação e comunique qualquer nível crítico.', 'critico', true, 4),
  (abertura_id, 10, 'Conferir temperaturas de refrigeração', 'Registre as temperaturas dos equipamentos refrigerados conforme o padrão definido pelo restaurante.', 'critico', true, 4),
  (abertura_id, 11, 'Conferir temperatura das proteínas', 'Verifique com termômetro de espeto a temperatura dos alimentos selecionados para uso no turno.', 'critico', true, 4),
  (abertura_id, 12, 'Verificar disponibilidade de insumos', 'Confira proteínas, hortifrutis, laticínios, secos, molhos e demais itens necessários à operação.', 'alto', false, 3),
  (abertura_id, 13, 'Conferir validade e etiquetagem', 'Verifique data de produção, abertura, descongelamento e validade de todos os produtos armazenados.', 'critico', true, 4),
  (abertura_id, 14, 'Verificar disponibilidade de utensílios', 'Confirme a presença de panelas, assadeiras, colheres, pinças, espátulas, facas e outros utensílios essenciais.', 'medio', false, 2),
  (abertura_id, 15, 'Abastecer estações de lavagem das mãos', 'Complete sabonete, papel-toalha e sanitizante. Confirme que as pias estão desobstruídas.', 'alto', false, 3),
  (abertura_id, 16, 'Organizar gestão de resíduos', 'Posicione lixeiras limpas, com sacos, tampa e pedal. Retire resíduos deixados pelo turno anterior.', 'alto', false, 3),
  (abertura_id, 17, 'Identificação do responsável', 'Informe nome, função, praça e horário de conclusão do checklist.', 'medio', false, 2);

  INSERT INTO public.checklist_items (template_id, position, title, guidance, priority, is_critical, weight) VALUES
  (fechamento_id, 1, 'Realizar limpeza geral', 'Higienize pisos, paredes, bancadas, equipamentos, refrigeradores, freezers e áreas de circulação.', 'alto', false, 3),
  (fechamento_id, 2, 'Conferir temperaturas de refrigeração', 'Registre as temperaturas antes do encerramento e comunique qualquer equipamento fora do padrão.', 'critico', true, 4),
  (fechamento_id, 3, 'Verificar insumos para o próximo turno', 'Confira os estoques e registre necessidades de produção, compra, descongelamento ou requisição.', 'alto', false, 3),
  (fechamento_id, 4, 'Conferir validade e etiquetagem', 'Verifique se todos os alimentos estão identificados, datados, tampados e armazenados corretamente.', 'critico', true, 4),
  (fechamento_id, 5, 'Higienizar e guardar utensílios', 'Lave, sanitize, seque e guarde panelas, assadeiras, facas, tábuas, espátulas e demais utensílios.', 'alto', false, 3),
  (fechamento_id, 6, 'Realizar limpeza dos ralos', 'Retire resíduos, higienize grelhas e confirme que não há obstrução ou acúmulo de alimento.', 'alto', false, 3),
  (fechamento_id, 7, 'Organizar gestão de resíduos', 'Retire o lixo, higienize as lixeiras e coloque sacos limpos para o próximo turno.', 'alto', false, 3),
  (fechamento_id, 8, 'Desligar o sistema de exaustão', 'Desligue coifas e exaustores após o término das atividades que geram calor ou fumaça.', 'critico', true, 4),
  (fechamento_id, 9, 'Desligar KDS, computadores e impressoras', 'Desligue telas, impressoras e equipamentos eletrônicos conforme o procedimento estabelecido.', 'medio', false, 2),
  (fechamento_id, 10, 'Fechar o sistema geral de gás', 'Feche o registro geral e confirme que todos os equipamentos a gás estão desligados.', 'critico', true, 4),
  (fechamento_id, 11, 'Verificar equipamentos elétricos', 'Confirme que fritadeiras, fornos, chapas, liquidificadores e demais equipamentos foram desligados.', 'critico', true, 4),
  (fechamento_id, 12, 'Higienizar KDS e telas', 'Faça a limpeza externa das telas, impressoras e computadores com material adequado. Não aplique líquido diretamente nos equipamentos.', 'medio', false, 2),
  (fechamento_id, 13, 'Realizar inspeção final da cozinha', 'Faça uma última ronda para verificar torneiras, iluminação, portas, equipamentos, câmaras e possíveis riscos.', 'critico', true, 4),
  (fechamento_id, 14, 'Identificação do responsável', 'Informe nome, função, praça, horário de conclusão e pendências deixadas para o próximo turno.', 'medio', false, 2);

  -- Encerramento do Salão (planned)
  INSERT INTO public.checklist_templates (sector_id, name, slug, description, kind, sort_order)
  VALUES (salao_id, 'Encerramento do Salão', 'encerramento-salao',
    'Checklist para encerrar o salão com segurança, limpeza e organização.', 'operacional', 1)
  RETURNING id INTO enc_salao_id;

  INSERT INTO public.checklist_items (template_id, position, title, guidance, priority, is_critical, weight, requires_photo_on_conforme) VALUES
  (enc_salao_id, 1, 'Limpar salão', 'Varra, passe pano e higienize o piso de todo o salão.', 'alto', false, 3, false),
  (enc_salao_id, 2, 'Limpar mesas', 'Higienize os tampos, laterais e pés de todas as mesas.', 'alto', false, 3, false),
  (enc_salao_id, 3, 'Organizar e posicionar mesas', 'Reposicione mesas e cadeiras conforme o layout do salão.', 'medio', false, 2, false),
  (enc_salao_id, 4, 'Organizar pratos, talheres e copos', 'Guarde e organize a louça limpa nas estações apropriadas.', 'medio', false, 2, false),
  (enc_salao_id, 5, 'Desligar ar-condicionados', 'Desligue todos os aparelhos de ar-condicionado do salão.', 'alto', false, 3, false),
  (enc_salao_id, 6, 'Devolução de rádios de comunicação', 'Recolha e devolva os rádios à central de comunicação.', 'medio', false, 2, false),
  (enc_salao_id, 7, 'Inspecionar banheiros', 'Verifique limpeza, papel, sabonete e condições gerais dos banheiros de clientes.', 'alto', false, 3, false),
  (enc_salao_id, 8, 'Checar rotas de emergência e extintores', 'Confirme rotas desobstruídas, sinalização visível e extintores no local.', 'critico', true, 4, false),
  (enc_salao_id, 9, 'Revisar aparência final', 'Faça uma última ronda para garantir que o salão está apresentável para o próximo turno.', 'medio', false, 2, false),
  (enc_salao_id, 10, 'Fechamento de portão principal', 'Feche e trave o portão principal ao final do encerramento.', 'critico', true, 4, false),
  (enc_salao_id, 11, 'Quem fez este checklist', 'Registre nas observações o nome do responsável pelo encerramento.', 'medio', false, 2, false),
  (enc_salao_id, 12, 'Desligar TVs', 'Desligue todas as TVs do salão. Foto obrigatória como comprovação.', 'alto', false, 3, true);
END $seed$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- ============ STORAGE POLICIES (attachments bucket) ============
CREATE POLICY "attachments read auth" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'attachments');
CREATE POLICY "attachments insert own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'attachments' AND owner = auth.uid());
CREATE POLICY "attachments delete own or admin" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'attachments' AND (owner = auth.uid() OR public.has_role(auth.uid(),'admin')));

-- ============ QUALITY MODULE ============
CREATE TABLE public.quality_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  target_score numeric NOT NULL DEFAULT 80,
  position int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quality_areas TO authenticated;
GRANT ALL ON public.quality_areas TO service_role;
ALTER TABLE public.quality_areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read areas" ON public.quality_areas FOR SELECT TO authenticated USING (true);
CREATE POLICY "manage areas admin" ON public.quality_areas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_qa_upd BEFORE UPDATE ON public.quality_areas FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.quality_sectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id uuid NOT NULL REFERENCES public.quality_areas(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  position int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(area_id, slug)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quality_sectors TO authenticated;
GRANT ALL ON public.quality_sectors TO service_role;
ALTER TABLE public.quality_sectors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read qsectors" ON public.quality_sectors FOR SELECT TO authenticated USING (true);
CREATE POLICY "manage qsectors admin" ON public.quality_sectors FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_qs_upd BEFORE UPDATE ON public.quality_sectors FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.quality_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id uuid NOT NULL REFERENCES public.quality_sectors(id) ON DELETE CASCADE,
  title text NOT NULL,
  guidance text,
  weight numeric NOT NULL DEFAULT 1,
  is_critical boolean NOT NULL DEFAULT false,
  requires_photo boolean NOT NULL DEFAULT false,
  position int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quality_items TO authenticated;
GRANT ALL ON public.quality_items TO service_role;
ALTER TABLE public.quality_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read qitems" ON public.quality_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "manage qitems admin" ON public.quality_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_qi_upd BEFORE UPDATE ON public.quality_items FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.quality_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auditor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  iso_year int NOT NULL,
  iso_week int NOT NULL,
  month int NOT NULL,
  year int NOT NULL,
  week_of_month int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'em_andamento',
  score numeric NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  notes text,
  auditor_signature text,
  responsible_signature text,
  responsible_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quality_audits TO authenticated;
GRANT ALL ON public.quality_audits TO service_role;
ALTER TABLE public.quality_audits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read audits" ON public.quality_audits FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert audits" ON public.quality_audits FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'auditor'));
CREATE POLICY "update audits" ON public.quality_audits FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR (public.has_role(auth.uid(),'auditor') AND auditor_id = auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR (public.has_role(auth.uid(),'auditor') AND auditor_id = auth.uid()));
CREATE POLICY "delete audits admin" ON public.quality_audits FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_qau_upd BEFORE UPDATE ON public.quality_audits FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.quality_audit_sectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id uuid NOT NULL REFERENCES public.quality_audits(id) ON DELETE CASCADE,
  sector_id uuid NOT NULL REFERENCES public.quality_sectors(id) ON DELETE CASCADE,
  score numeric NOT NULL DEFAULT 0,
  total_items int NOT NULL DEFAULT 0,
  conform int NOT NULL DEFAULT 0,
  non_conform int NOT NULL DEFAULT 0,
  na int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(audit_id, sector_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quality_audit_sectors TO authenticated;
GRANT ALL ON public.quality_audit_sectors TO service_role;
ALTER TABLE public.quality_audit_sectors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read qas" ON public.quality_audit_sectors FOR SELECT TO authenticated USING (true);
CREATE POLICY "write qas" ON public.quality_audit_sectors FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'auditor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'auditor'));
CREATE TRIGGER trg_qas_upd BEFORE UPDATE ON public.quality_audit_sectors FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.quality_audit_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id uuid NOT NULL REFERENCES public.quality_audits(id) ON DELETE CASCADE,
  sector_id uuid NOT NULL REFERENCES public.quality_sectors(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.quality_items(id) ON DELETE CASCADE,
  answer text NOT NULL,
  observation text,
  justification text,
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(audit_id, item_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quality_audit_answers TO authenticated;
GRANT ALL ON public.quality_audit_answers TO service_role;
ALTER TABLE public.quality_audit_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read qans" ON public.quality_audit_answers FOR SELECT TO authenticated USING (true);
CREATE POLICY "write qans" ON public.quality_audit_answers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'auditor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'auditor'));
CREATE TRIGGER trg_qan_upd BEFORE UPDATE ON public.quality_audit_answers FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.quality_monthly_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year int NOT NULL,
  month int NOT NULL,
  score numeric NOT NULL DEFAULT 0,
  audits_count int NOT NULL DEFAULT 0,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(year, month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quality_monthly_reports TO authenticated;
GRANT ALL ON public.quality_monthly_reports TO service_role;
ALTER TABLE public.quality_monthly_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read reports" ON public.quality_monthly_reports FOR SELECT TO authenticated USING (true);
CREATE POLICY "write reports" ON public.quality_monthly_reports FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'auditor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'auditor'));
CREATE TRIGGER trg_qmr_upd BEFORE UPDATE ON public.quality_monthly_reports FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Link action_plans to quality audits (optional)
ALTER TABLE public.action_plans ADD COLUMN quality_audit_id uuid REFERENCES public.quality_audits(id) ON DELETE SET NULL;
ALTER TABLE public.action_plans ADD COLUMN quality_answer_id uuid REFERENCES public.quality_audit_answers(id) ON DELETE SET NULL;
ALTER TABLE public.action_plans ADD CONSTRAINT action_plans_source_chk CHECK (answer_id IS NOT NULL OR quality_answer_id IS NOT NULL OR quality_audit_id IS NOT NULL);

INSERT INTO public.quality_areas (name, slug, position) VALUES
  ('Cozinha','cozinha',1),
  ('Salão','salao',2),
  ('Delivery','delivery',3),
  ('Almoxarifado','almoxarifado',4);

INSERT INTO public.quality_sectors (area_id, name, slug, position)
SELECT a.id, s.name, s.slug, s.position FROM public.quality_areas a
JOIN (VALUES
  ('cozinha','Fritadeira','fritadeira',1),
  ('cozinha','Fogão','fogao',2),
  ('cozinha','Proteínas','proteinas',3),
  ('cozinha','Finalizações e Confeitaria','finalizacoes-confeitaria',4),
  ('cozinha','Porcionamento','porcionamento',5),
  ('cozinha','Produção Quente','producao-quente',6)
) s(area_slug,name,slug,position) ON s.area_slug = a.slug;
