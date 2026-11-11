
-- Drop dependent policies in public
DROP POLICY IF EXISTS "templates admin write" ON public.checklist_templates;
DROP POLICY IF EXISTS "items admin write" ON public.checklist_items;
DROP POLICY IF EXISTS "exec insert auditor/admin" ON public.checklist_executions;
DROP POLICY IF EXISTS "exec update own or admin" ON public.checklist_executions;
DROP POLICY IF EXISTS "answers write own execution or admin" ON public.checklist_answers;
DROP POLICY IF EXISTS "answers update own execution or admin" ON public.checklist_answers;
DROP POLICY IF EXISTS "answers delete own execution or admin" ON public.checklist_answers;
DROP POLICY IF EXISTS "manage areas admin" ON public.quality_areas;
DROP POLICY IF EXISTS "manage qsectors admin" ON public.quality_sectors;
DROP POLICY IF EXISTS "manage qitems admin" ON public.quality_items;
DROP POLICY IF EXISTS "insert audits" ON public.quality_audits;
DROP POLICY IF EXISTS "update audits" ON public.quality_audits;
DROP POLICY IF EXISTS "delete audits admin" ON public.quality_audits;
DROP POLICY IF EXISTS "write qas" ON public.quality_audit_sectors;
DROP POLICY IF EXISTS "write qans" ON public.quality_audit_answers;
DROP POLICY IF EXISTS "write reports" ON public.quality_monthly_reports;
DROP POLICY IF EXISTS "settings admin write" ON public.restaurant_settings;
DROP POLICY IF EXISTS "sectors admin write" ON public.sectors;
DROP POLICY IF EXISTS "areas admin write" ON public.areas;
DROP POLICY IF EXISTS "plans update own or admin" ON public.action_plans;
DROP POLICY IF EXISTS "attachments delete own or admin" ON public.attachments;
DROP POLICY IF EXISTS "roles manage admin" ON public.user_roles;
DROP POLICY IF EXISTS "roles select admin" ON public.user_roles;
-- Drop dependent policies in storage
DROP POLICY IF EXISTS "logos admin insert" ON storage.objects;
DROP POLICY IF EXISTS "logos admin update" ON storage.objects;
DROP POLICY IF EXISTS "logos admin delete" ON storage.objects;
DROP POLICY IF EXISTS "attachments delete own or admin" ON storage.objects;

-- Rebuild enum
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
ALTER TABLE public.user_roles ALTER COLUMN role TYPE text USING role::text;
UPDATE public.user_roles SET role = 'gestor' WHERE role = 'visualizador';
DROP TYPE public.app_role;
CREATE TYPE public.app_role AS ENUM ('admin','gestor','auditor','operador');
ALTER TABLE public.user_roles ALTER COLUMN role TYPE public.app_role USING role::public.app_role;

-- has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- Default new-user role = operador
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'operador') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- user_roles
CREATE POLICY "roles select admin" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "roles manage admin" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Config: admin ou gestor
CREATE POLICY "settings admin write" ON public.restaurant_settings FOR ALL USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')) WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "sectors admin write" ON public.sectors FOR ALL USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')) WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "areas admin write" ON public.areas FOR ALL USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')) WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

-- Checklists (config): admin ou gestor
CREATE POLICY "templates admin write" ON public.checklist_templates FOR ALL USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')) WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "items admin write" ON public.checklist_items FOR ALL USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')) WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

-- Checklists (execução): admin ou operador
CREATE POLICY "exec insert operador/admin" ON public.checklist_executions FOR INSERT WITH CHECK ((auditor_id = auth.uid()) AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operador')));
CREATE POLICY "exec update own or admin" ON public.checklist_executions FOR UPDATE USING ((auditor_id = auth.uid()) OR public.has_role(auth.uid(), 'admin')) WITH CHECK ((auditor_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "answers write own execution or admin" ON public.checklist_answers FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.checklist_executions e WHERE e.id = checklist_answers.execution_id AND (e.auditor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));
CREATE POLICY "answers update own execution or admin" ON public.checklist_answers FOR UPDATE USING (EXISTS (SELECT 1 FROM public.checklist_executions e WHERE e.id = checklist_answers.execution_id AND (e.auditor_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))) WITH CHECK (EXISTS (SELECT 1 FROM public.checklist_executions e WHERE e.id = checklist_answers.execution_id AND (e.auditor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));
CREATE POLICY "answers delete own execution or admin" ON public.checklist_answers FOR DELETE USING (EXISTS (SELECT 1 FROM public.checklist_executions e WHERE e.id = checklist_answers.execution_id AND (e.auditor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

-- Qualidade config (perguntas/áreas): admin, gestor ou auditor
CREATE POLICY "manage areas admin" ON public.quality_areas FOR ALL USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor') OR public.has_role(auth.uid(), 'auditor')) WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor') OR public.has_role(auth.uid(), 'auditor'));
CREATE POLICY "manage qsectors admin" ON public.quality_sectors FOR ALL USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor') OR public.has_role(auth.uid(), 'auditor')) WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor') OR public.has_role(auth.uid(), 'auditor'));
CREATE POLICY "manage qitems admin" ON public.quality_items FOR ALL USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor') OR public.has_role(auth.uid(), 'auditor')) WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor') OR public.has_role(auth.uid(), 'auditor'));

-- Qualidade execução: admin ou auditor
CREATE POLICY "insert audits" ON public.quality_audits FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'auditor'));
CREATE POLICY "update audits" ON public.quality_audits FOR UPDATE USING (public.has_role(auth.uid(), 'admin') OR (public.has_role(auth.uid(), 'auditor') AND auditor_id = auth.uid())) WITH CHECK (public.has_role(auth.uid(), 'admin') OR (public.has_role(auth.uid(), 'auditor') AND auditor_id = auth.uid()));
CREATE POLICY "delete audits admin" ON public.quality_audits FOR DELETE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "write qas" ON public.quality_audit_sectors FOR ALL USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'auditor')) WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'auditor'));
CREATE POLICY "write qans" ON public.quality_audit_answers FOR ALL USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'auditor')) WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'auditor'));
CREATE POLICY "write reports" ON public.quality_monthly_reports FOR ALL USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'auditor')) WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'auditor'));

-- Planos / anexos
CREATE POLICY "plans update own or admin" ON public.action_plans FOR UPDATE USING (created_by = auth.uid() OR responsible_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "attachments delete own or admin" ON public.attachments FOR DELETE USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Storage (logos): admin ou gestor
CREATE POLICY "logos admin insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'logos' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')));
CREATE POLICY "logos admin update" ON storage.objects FOR UPDATE USING (bucket_id = 'logos' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')));
CREATE POLICY "logos admin delete" ON storage.objects FOR DELETE USING (bucket_id = 'logos' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')));
-- Storage (attachments): dono ou admin
CREATE POLICY "attachments delete own or admin" ON storage.objects FOR DELETE USING (bucket_id = 'attachments' AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin')));
