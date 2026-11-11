-- Separa leitura (aberta) da escrita (restrita) em checklist_answers.
DROP POLICY IF EXISTS "answers via execution" ON public.checklist_answers;

CREATE POLICY "answers read all auth"
  ON public.checklist_answers FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "answers write own execution or admin"
  ON public.checklist_answers FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.checklist_executions e
    WHERE e.id = execution_id
      AND (e.auditor_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  ));

CREATE POLICY "answers update own execution or admin"
  ON public.checklist_answers FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.checklist_executions e
    WHERE e.id = execution_id
      AND (e.auditor_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.checklist_executions e
    WHERE e.id = execution_id
      AND (e.auditor_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  ));

CREATE POLICY "answers delete own execution or admin"
  ON public.checklist_answers FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.checklist_executions e
    WHERE e.id = execution_id
      AND (e.auditor_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  ));