-- Permite que qualquer usuário autenticado (incluindo Operador/auditor) visualize execuções de checklist para tomada de decisão.
DROP POLICY IF EXISTS "exec read own or admin/visu" ON public.checklist_executions;
CREATE POLICY "exec read all auth"
  ON public.checklist_executions FOR SELECT TO authenticated
  USING (true);