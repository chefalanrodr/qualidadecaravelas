-- Operators execute operational checklists.
-- Admin/gestor configure checklist definitions; admin/operator create and update executions.

DROP POLICY IF EXISTS "ct auth all" ON public.checklist_templates;
DROP POLICY IF EXISTS "templates read all auth" ON public.checklist_templates;
DROP POLICY IF EXISTS "checklist_templates read auth" ON public.checklist_templates;
DROP POLICY IF EXISTS "templates admin write" ON public.checklist_templates;
DROP POLICY IF EXISTS "checklist_templates write admin/gestor insert" ON public.checklist_templates;
DROP POLICY IF EXISTS "checklist_templates write admin/gestor update" ON public.checklist_templates;
DROP POLICY IF EXISTS "checklist_templates write admin/gestor delete" ON public.checklist_templates;
DROP POLICY IF EXISTS "checklist_templates configure admin gestor insert" ON public.checklist_templates;
DROP POLICY IF EXISTS "checklist_templates configure admin gestor update" ON public.checklist_templates;
DROP POLICY IF EXISTS "checklist_templates configure admin gestor delete" ON public.checklist_templates;

CREATE POLICY "checklist_templates read auth"
ON public.checklist_templates FOR SELECT TO authenticated
USING (true);
CREATE POLICY "checklist_templates configure admin gestor insert"
ON public.checklist_templates FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'gestor'::public.app_role));
CREATE POLICY "checklist_templates configure admin gestor update"
ON public.checklist_templates FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'gestor'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'gestor'::public.app_role));
CREATE POLICY "checklist_templates configure admin gestor delete"
ON public.checklist_templates FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'gestor'::public.app_role));

DROP POLICY IF EXISTS "ci auth all" ON public.checklist_items;
DROP POLICY IF EXISTS "items read all auth" ON public.checklist_items;
DROP POLICY IF EXISTS "checklist_items read auth" ON public.checklist_items;
DROP POLICY IF EXISTS "items admin write" ON public.checklist_items;
DROP POLICY IF EXISTS "checklist_items write admin/gestor insert" ON public.checklist_items;
DROP POLICY IF EXISTS "checklist_items write admin/gestor update" ON public.checklist_items;
DROP POLICY IF EXISTS "checklist_items write admin/gestor delete" ON public.checklist_items;
DROP POLICY IF EXISTS "checklist_items configure admin gestor insert" ON public.checklist_items;
DROP POLICY IF EXISTS "checklist_items configure admin gestor update" ON public.checklist_items;
DROP POLICY IF EXISTS "checklist_items configure admin gestor delete" ON public.checklist_items;

CREATE POLICY "checklist_items read auth"
ON public.checklist_items FOR SELECT TO authenticated
USING (true);
CREATE POLICY "checklist_items configure admin gestor insert"
ON public.checklist_items FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'gestor'::public.app_role));
CREATE POLICY "checklist_items configure admin gestor update"
ON public.checklist_items FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'gestor'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'gestor'::public.app_role));
CREATE POLICY "checklist_items configure admin gestor delete"
ON public.checklist_items FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'gestor'::public.app_role));

DROP POLICY IF EXISTS "ce auth all" ON public.checklist_executions;
DROP POLICY IF EXISTS "exec read own or admin/visu" ON public.checklist_executions;
DROP POLICY IF EXISTS "exec read all auth" ON public.checklist_executions;
DROP POLICY IF EXISTS "checklist_executions read auth" ON public.checklist_executions;
DROP POLICY IF EXISTS "exec insert auditor/admin" ON public.checklist_executions;
DROP POLICY IF EXISTS "exec insert operador/admin" ON public.checklist_executions;
DROP POLICY IF EXISTS "exec update own or admin" ON public.checklist_executions;
DROP POLICY IF EXISTS "checklist_executions write admin/gestor insert" ON public.checklist_executions;
DROP POLICY IF EXISTS "checklist_executions write admin/gestor update" ON public.checklist_executions;
DROP POLICY IF EXISTS "checklist_executions write admin/gestor delete" ON public.checklist_executions;
DROP POLICY IF EXISTS "checklist_executions insert admin operador owner" ON public.checklist_executions;
DROP POLICY IF EXISTS "checklist_executions update admin operador owner" ON public.checklist_executions;
DROP POLICY IF EXISTS "checklist_executions delete admin" ON public.checklist_executions;

CREATE POLICY "checklist_executions read auth"
ON public.checklist_executions FOR SELECT TO authenticated
USING (true);
CREATE POLICY "checklist_executions insert admin operador owner"
ON public.checklist_executions FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR (public.has_role(auth.uid(), 'operador'::public.app_role) AND auditor_id = auth.uid())
);
CREATE POLICY "checklist_executions update admin operador owner"
ON public.checklist_executions FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR (public.has_role(auth.uid(), 'operador'::public.app_role) AND auditor_id = auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR (public.has_role(auth.uid(), 'operador'::public.app_role) AND auditor_id = auth.uid())
);
CREATE POLICY "checklist_executions delete admin"
ON public.checklist_executions FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "ca auth all" ON public.checklist_answers;
DROP POLICY IF EXISTS "answers via execution" ON public.checklist_answers;
DROP POLICY IF EXISTS "answers read all auth" ON public.checklist_answers;
DROP POLICY IF EXISTS "checklist_answers read auth" ON public.checklist_answers;
DROP POLICY IF EXISTS "answers write own execution or admin" ON public.checklist_answers;
DROP POLICY IF EXISTS "answers update own execution or admin" ON public.checklist_answers;
DROP POLICY IF EXISTS "answers delete own execution or admin" ON public.checklist_answers;
DROP POLICY IF EXISTS "checklist_answers write admin/gestor insert" ON public.checklist_answers;
DROP POLICY IF EXISTS "checklist_answers write admin/gestor update" ON public.checklist_answers;
DROP POLICY IF EXISTS "checklist_answers write admin/gestor delete" ON public.checklist_answers;
DROP POLICY IF EXISTS "checklist_answers insert admin operador owner" ON public.checklist_answers;
DROP POLICY IF EXISTS "checklist_answers update admin operador owner" ON public.checklist_answers;
DROP POLICY IF EXISTS "checklist_answers delete admin operador owner" ON public.checklist_answers;

CREATE POLICY "checklist_answers read auth"
ON public.checklist_answers FOR SELECT TO authenticated
USING (true);
CREATE POLICY "checklist_answers insert admin operador owner"
ON public.checklist_answers FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.checklist_executions e
    WHERE e.id = checklist_answers.execution_id
      AND e.auditor_id = auth.uid()
      AND public.has_role(auth.uid(), 'operador'::public.app_role)
  )
);
CREATE POLICY "checklist_answers update admin operador owner"
ON public.checklist_answers FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.checklist_executions e
    WHERE e.id = checklist_answers.execution_id
      AND e.auditor_id = auth.uid()
      AND public.has_role(auth.uid(), 'operador'::public.app_role)
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.checklist_executions e
    WHERE e.id = checklist_answers.execution_id
      AND e.auditor_id = auth.uid()
      AND public.has_role(auth.uid(), 'operador'::public.app_role)
  )
);
CREATE POLICY "checklist_answers delete admin operador owner"
ON public.checklist_answers FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.checklist_executions e
    WHERE e.id = checklist_answers.execution_id
      AND e.auditor_id = auth.uid()
      AND public.has_role(auth.uid(), 'operador'::public.app_role)
  )
);
