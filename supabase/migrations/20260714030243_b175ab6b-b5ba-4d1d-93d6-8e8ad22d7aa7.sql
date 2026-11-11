
CREATE TYPE public.app_role AS ENUM ('admin', 'gestor', 'auditor', 'operador');

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  role_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "profiles read all auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles self insert" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles admin delete" ON public.profiles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "roles read own or admin" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "roles admin write" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.restaurant_settings (
  id INT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Confere Aí',
  greeting TEXT,
  logo_url TEXT,
  score_bands JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_settings TO authenticated;
GRANT ALL ON public.restaurant_settings TO service_role;
ALTER TABLE public.restaurant_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings read all auth" ON public.restaurant_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings admin/gestor write" ON public.restaurant_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON public.restaurant_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
INSERT INTO public.restaurant_settings (id, name) VALUES (1, 'Confere Aí') ON CONFLICT DO NOTHING;

CREATE TABLE public.sectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sectors TO authenticated;
GRANT ALL ON public.sectors TO service_role;
ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sectors auth all" ON public.sectors FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_sectors_updated BEFORE UPDATE ON public.sectors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id UUID NOT NULL REFERENCES public.sectors(id) ON DELETE CASCADE,
  name TEXT NOT NULL, sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.areas TO authenticated;
GRANT ALL ON public.areas TO service_role;
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "areas auth all" ON public.areas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_areas_updated BEFORE UPDATE ON public.areas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id UUID REFERENCES public.sectors(id) ON DELETE SET NULL,
  name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, description TEXT,
  kind TEXT NOT NULL DEFAULT 'operacional',
  is_active BOOLEAN NOT NULL DEFAULT true, sort_order INT NOT NULL DEFAULT 0,
  schedule_days JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_templates TO authenticated;
GRANT ALL ON public.checklist_templates TO service_role;
ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ct auth all" ON public.checklist_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_ct_updated BEFORE UPDATE ON public.checklist_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
  position INT NOT NULL DEFAULT 0, title TEXT NOT NULL, guidance TEXT, priority TEXT,
  is_critical BOOLEAN NOT NULL DEFAULT false, weight NUMERIC NOT NULL DEFAULT 1,
  requires_photo_on_conforme BOOLEAN NOT NULL DEFAULT false,
  is_required BOOLEAN NOT NULL DEFAULT true, allow_not_applicable BOOLEAN NOT NULL DEFAULT true,
  has_goal BOOLEAN NOT NULL DEFAULT false, goal_value TEXT, evidence_hints TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_items TO authenticated;
GRANT ALL ON public.checklist_items TO service_role;
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ci auth all" ON public.checklist_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_ci_updated BEFORE UPDATE ON public.checklist_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.checklist_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
  auditor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'em_andamento',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ, score NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_executions TO authenticated;
GRANT ALL ON public.checklist_executions TO service_role;
ALTER TABLE public.checklist_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ce auth all" ON public.checklist_executions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_ce_updated BEFORE UPDATE ON public.checklist_executions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.checklist_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES public.checklist_executions(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.checklist_items(id) ON DELETE CASCADE,
  status TEXT NOT NULL, observation TEXT, justification TEXT,
  answered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (execution_id, item_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_answers TO authenticated;
GRANT ALL ON public.checklist_answers TO service_role;
ALTER TABLE public.checklist_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ca auth all" ON public.checklist_answers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_ca_updated BEFORE UPDATE ON public.checklist_answers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.quality_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
  target_score NUMERIC NOT NULL DEFAULT 90, position INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quality_areas TO authenticated;
GRANT ALL ON public.quality_areas TO service_role;
ALTER TABLE public.quality_areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qa auth all" ON public.quality_areas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_qa_updated BEFORE UPDATE ON public.quality_areas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.quality_sectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id UUID NOT NULL REFERENCES public.quality_areas(id) ON DELETE CASCADE,
  name TEXT NOT NULL, slug TEXT NOT NULL, position INT NOT NULL DEFAULT 0,
  target_score NUMERIC NOT NULL DEFAULT 90, is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (area_id, slug)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quality_sectors TO authenticated;
GRANT ALL ON public.quality_sectors TO service_role;
ALTER TABLE public.quality_sectors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qs auth all" ON public.quality_sectors FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_qs_updated BEFORE UPDATE ON public.quality_sectors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.quality_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id UUID NOT NULL REFERENCES public.quality_sectors(id) ON DELETE CASCADE,
  title TEXT NOT NULL, guidance TEXT,
  weight NUMERIC NOT NULL DEFAULT 1, is_critical BOOLEAN NOT NULL DEFAULT false,
  requires_photo BOOLEAN NOT NULL DEFAULT false, position INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quality_items TO authenticated;
GRANT ALL ON public.quality_items TO service_role;
ALTER TABLE public.quality_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qi auth all" ON public.quality_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_qi_updated BEFORE UPDATE ON public.quality_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.quality_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auditor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  iso_year INT NOT NULL, iso_week INT NOT NULL,
  week_of_month INT, month INT, year INT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(), finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'em_andamento', score NUMERIC, auditor_signature TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quality_audits TO authenticated;
GRANT ALL ON public.quality_audits TO service_role;
ALTER TABLE public.quality_audits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qau auth all" ON public.quality_audits FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_qau_updated BEFORE UPDATE ON public.quality_audits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.quality_audit_sectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID NOT NULL REFERENCES public.quality_audits(id) ON DELETE CASCADE,
  sector_id UUID NOT NULL REFERENCES public.quality_sectors(id) ON DELETE CASCADE,
  score NUMERIC NOT NULL DEFAULT 0, total_items INT NOT NULL DEFAULT 0,
  conform INT NOT NULL DEFAULT 0, non_conform INT NOT NULL DEFAULT 0, na INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (audit_id, sector_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quality_audit_sectors TO authenticated;
GRANT ALL ON public.quality_audit_sectors TO service_role;
ALTER TABLE public.quality_audit_sectors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qas auth all" ON public.quality_audit_sectors FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_qas_updated BEFORE UPDATE ON public.quality_audit_sectors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.quality_audit_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID NOT NULL REFERENCES public.quality_audits(id) ON DELETE CASCADE,
  sector_id UUID NOT NULL REFERENCES public.quality_sectors(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.quality_items(id) ON DELETE CASCADE,
  answer TEXT NOT NULL, observation TEXT, justification TEXT, photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (audit_id, item_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quality_audit_answers TO authenticated;
GRANT ALL ON public.quality_audit_answers TO service_role;
ALTER TABLE public.quality_audit_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qaa auth all" ON public.quality_audit_answers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_qaa_updated BEFORE UPDATE ON public.quality_audit_answers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.action_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_answer_id UUID REFERENCES public.checklist_answers(id) ON DELETE CASCADE,
  quality_audit_id UUID REFERENCES public.quality_audits(id) ON DELETE SET NULL,
  quality_answer_id UUID REFERENCES public.quality_audit_answers(id) ON DELETE SET NULL,
  description TEXT NOT NULL, solution TEXT, responsible TEXT,
  responsible_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date TIMESTAMPTZ, status TEXT NOT NULL DEFAULT 'aberto', priority TEXT,
  corrected_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.action_plans TO authenticated;
GRANT ALL ON public.action_plans TO service_role;
ALTER TABLE public.action_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ap auth all" ON public.action_plans FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_ap_updated BEFORE UPDATE ON public.action_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  answer_id UUID REFERENCES public.checklist_answers(id) ON DELETE CASCADE,
  action_plan_id UUID REFERENCES public.action_plans(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'photo',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attachments TO authenticated;
GRANT ALL ON public.attachments TO service_role;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "att auth all" ON public.attachments FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE, p256dh TEXT NOT NULL, auth TEXT NOT NULL, user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "push read own" ON public.push_subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "push insert own" ON public.push_subscriptions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "push update own" ON public.push_subscriptions FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "push delete own" ON public.push_subscriptions FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER trg_push_updated BEFORE UPDATE ON public.push_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "attachments read auth" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'attachments');
CREATE POLICY "attachments write auth" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'attachments');
CREATE POLICY "attachments update auth" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'attachments') WITH CHECK (bucket_id = 'attachments');
CREATE POLICY "attachments delete auth" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'attachments');

CREATE POLICY "logos read auth" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'logos');
CREATE POLICY "logos write admins" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'logos' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')));
CREATE POLICY "logos update admins" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'logos' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')))
  WITH CHECK (bucket_id = 'logos' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')));
CREATE POLICY "logos delete admins" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'logos' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')));
