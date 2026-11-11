
-- Helper: replace permissive FOR ALL policies with SELECT (auth) + write (admin/gestor)
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'action_plans','areas','attachments','checklist_answers','checklist_executions',
    'checklist_items','checklist_templates','quality_areas','quality_audit_answers',
    'quality_audit_sectors','quality_audits','quality_items','quality_sectors','sectors'
  ];
  polnames text[] := ARRAY[
    'ap auth all','areas auth all','att auth all','ca auth all','ce auth all',
    'ci auth all','ct auth all','qa auth all','qaa auth all',
    'qas auth all','qau auth all','qi auth all','qs auth all','sectors auth all'
  ];
  i int;
BEGIN
  FOR i IN 1..array_length(tables,1) LOOP
    t := tables[i];
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', polnames[i], t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)', t||' read auth', t);
    EXECUTE format($f$CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gestor'::app_role))$f$, t||' write admin/gestor insert', t);
    EXECUTE format($f$CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gestor'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gestor'::app_role))$f$, t||' write admin/gestor update', t);
    EXECUTE format($f$CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gestor'::app_role))$f$, t||' write admin/gestor delete', t);
  END LOOP;
END $$;

-- Lock down trigger functions (should not be callable via API)
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
