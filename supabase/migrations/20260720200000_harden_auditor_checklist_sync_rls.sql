-- Ensure checklist offline sync works for every role allowed by the app matrix.
-- Auditor de qualidade can start and finish checklists, so queued checklist
-- answers/finalization must pass RLS when the device comes back online.

DROP POLICY IF EXISTS "ce auth all" ON public.checklist_executions;
DROP POLICY IF EXISTS "exec insert auditor/admin" ON public.checklist_executions;
DROP POLICY IF EXISTS "exec insert operador/admin" ON public.checklist_executions;
DROP POLICY IF EXISTS "exec update own or admin" ON public.checklist_executions;
DROP POLICY IF EXISTS "checklist_executions insert admin operador owner" ON public.checklist_executions;
DROP POLICY IF EXISTS "checklist_executions update admin operador owner" ON public.checklist_executions;
DROP POLICY IF EXISTS "checklist_executions insert allowed owner" ON public.checklist_executions;
DROP POLICY IF EXISTS "checklist_executions update allowed owner" ON public.checklist_executions;

CREATE POLICY "checklist_executions insert allowed owner"
ON public.checklist_executions FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR (
    auditor_id = auth.uid()
    AND (
      public.has_role(auth.uid(), 'gestor'::public.app_role)
      OR public.has_role(auth.uid(), 'auditor'::public.app_role)
      OR public.has_role(auth.uid(), 'operador'::public.app_role)
    )
  )
);

CREATE POLICY "checklist_executions update allowed owner"
ON public.checklist_executions FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR (
    auditor_id = auth.uid()
    AND (
      public.has_role(auth.uid(), 'gestor'::public.app_role)
      OR public.has_role(auth.uid(), 'auditor'::public.app_role)
      OR public.has_role(auth.uid(), 'operador'::public.app_role)
    )
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR (
    auditor_id = auth.uid()
    AND (
      public.has_role(auth.uid(), 'gestor'::public.app_role)
      OR public.has_role(auth.uid(), 'auditor'::public.app_role)
      OR public.has_role(auth.uid(), 'operador'::public.app_role)
    )
  )
);

DROP POLICY IF EXISTS "ca auth all" ON public.checklist_answers;
DROP POLICY IF EXISTS "answers via execution" ON public.checklist_answers;
DROP POLICY IF EXISTS "answers write own execution or admin" ON public.checklist_answers;
DROP POLICY IF EXISTS "answers update own execution or admin" ON public.checklist_answers;
DROP POLICY IF EXISTS "answers delete own execution or admin" ON public.checklist_answers;
DROP POLICY IF EXISTS "checklist_answers insert admin operador owner" ON public.checklist_answers;
DROP POLICY IF EXISTS "checklist_answers update admin operador owner" ON public.checklist_answers;
DROP POLICY IF EXISTS "checklist_answers delete admin operador owner" ON public.checklist_answers;
DROP POLICY IF EXISTS "checklist_answers insert allowed owner" ON public.checklist_answers;
DROP POLICY IF EXISTS "checklist_answers update allowed owner" ON public.checklist_answers;
DROP POLICY IF EXISTS "checklist_answers delete allowed owner" ON public.checklist_answers;

CREATE POLICY "checklist_answers insert allowed owner"
ON public.checklist_answers FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.checklist_executions e
    WHERE e.id = checklist_answers.execution_id
      AND e.auditor_id = auth.uid()
      AND (
        public.has_role(auth.uid(), 'gestor'::public.app_role)
        OR public.has_role(auth.uid(), 'auditor'::public.app_role)
        OR public.has_role(auth.uid(), 'operador'::public.app_role)
      )
  )
);

CREATE POLICY "checklist_answers update allowed owner"
ON public.checklist_answers FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.checklist_executions e
    WHERE e.id = checklist_answers.execution_id
      AND e.auditor_id = auth.uid()
      AND (
        public.has_role(auth.uid(), 'gestor'::public.app_role)
        OR public.has_role(auth.uid(), 'auditor'::public.app_role)
        OR public.has_role(auth.uid(), 'operador'::public.app_role)
      )
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.checklist_executions e
    WHERE e.id = checklist_answers.execution_id
      AND e.auditor_id = auth.uid()
      AND (
        public.has_role(auth.uid(), 'gestor'::public.app_role)
        OR public.has_role(auth.uid(), 'auditor'::public.app_role)
        OR public.has_role(auth.uid(), 'operador'::public.app_role)
      )
  )
);

CREATE POLICY "checklist_answers delete allowed owner"
ON public.checklist_answers FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.checklist_executions e
    WHERE e.id = checklist_answers.execution_id
      AND e.auditor_id = auth.uid()
      AND (
        public.has_role(auth.uid(), 'gestor'::public.app_role)
        OR public.has_role(auth.uid(), 'auditor'::public.app_role)
        OR public.has_role(auth.uid(), 'operador'::public.app_role)
      )
  )
);
