-- Align RLS with the current app access matrix.
-- admin: full access
-- gestor: all operational areas except administration
-- auditor: quality audit/configuration, checklists, dashboards and reports
-- operador: checklists, dashboard and own profile settings

-- Checklist definitions are configured from the administration area.
DROP POLICY IF EXISTS "sectors auth all" ON public.sectors;
DROP POLICY IF EXISTS "sectors read all auth" ON public.sectors;
DROP POLICY IF EXISTS "sectors read auth" ON public.sectors;
DROP POLICY IF EXISTS "sectors admin write" ON public.sectors;
DROP POLICY IF EXISTS "sectors write admin/gestor insert" ON public.sectors;
DROP POLICY IF EXISTS "sectors write admin/gestor update" ON public.sectors;
DROP POLICY IF EXISTS "sectors write admin/gestor delete" ON public.sectors;
DROP POLICY IF EXISTS "sectors configure admin insert" ON public.sectors;
DROP POLICY IF EXISTS "sectors configure admin update" ON public.sectors;
DROP POLICY IF EXISTS "sectors configure admin delete" ON public.sectors;

CREATE POLICY "sectors read auth"
ON public.sectors FOR SELECT TO authenticated
USING (true);
CREATE POLICY "sectors configure admin insert"
ON public.sectors FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "sectors configure admin update"
ON public.sectors FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "sectors configure admin delete"
ON public.sectors FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "areas auth all" ON public.areas;
DROP POLICY IF EXISTS "areas read all auth" ON public.areas;
DROP POLICY IF EXISTS "areas read auth" ON public.areas;
DROP POLICY IF EXISTS "areas admin write" ON public.areas;
DROP POLICY IF EXISTS "areas write admin/gestor insert" ON public.areas;
DROP POLICY IF EXISTS "areas write admin/gestor update" ON public.areas;
DROP POLICY IF EXISTS "areas write admin/gestor delete" ON public.areas;
DROP POLICY IF EXISTS "areas configure admin insert" ON public.areas;
DROP POLICY IF EXISTS "areas configure admin update" ON public.areas;
DROP POLICY IF EXISTS "areas configure admin delete" ON public.areas;

CREATE POLICY "areas read auth"
ON public.areas FOR SELECT TO authenticated
USING (true);
CREATE POLICY "areas configure admin insert"
ON public.areas FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "areas configure admin update"
ON public.areas FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "areas configure admin delete"
ON public.areas FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "checklist_templates configure admin gestor insert" ON public.checklist_templates;
DROP POLICY IF EXISTS "checklist_templates configure admin gestor update" ON public.checklist_templates;
DROP POLICY IF EXISTS "checklist_templates configure admin gestor delete" ON public.checklist_templates;
DROP POLICY IF EXISTS "checklist_templates configure admin insert" ON public.checklist_templates;
DROP POLICY IF EXISTS "checklist_templates configure admin update" ON public.checklist_templates;
DROP POLICY IF EXISTS "checklist_templates configure admin delete" ON public.checklist_templates;

CREATE POLICY "checklist_templates configure admin insert"
ON public.checklist_templates FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "checklist_templates configure admin update"
ON public.checklist_templates FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "checklist_templates configure admin delete"
ON public.checklist_templates FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "checklist_items configure admin gestor insert" ON public.checklist_items;
DROP POLICY IF EXISTS "checklist_items configure admin gestor update" ON public.checklist_items;
DROP POLICY IF EXISTS "checklist_items configure admin gestor delete" ON public.checklist_items;
DROP POLICY IF EXISTS "checklist_items configure admin insert" ON public.checklist_items;
DROP POLICY IF EXISTS "checklist_items configure admin update" ON public.checklist_items;
DROP POLICY IF EXISTS "checklist_items configure admin delete" ON public.checklist_items;

CREATE POLICY "checklist_items configure admin insert"
ON public.checklist_items FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "checklist_items configure admin update"
ON public.checklist_items FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "checklist_items configure admin delete"
ON public.checklist_items FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Operational checklist execution is allowed for admin, gestor, auditor and operador.
DROP POLICY IF EXISTS "checklist_executions insert admin operador owner" ON public.checklist_executions;
DROP POLICY IF EXISTS "checklist_executions update admin operador owner" ON public.checklist_executions;
DROP POLICY IF EXISTS "checklist_executions delete admin" ON public.checklist_executions;
DROP POLICY IF EXISTS "checklist_executions insert allowed owner" ON public.checklist_executions;
DROP POLICY IF EXISTS "checklist_executions update allowed owner" ON public.checklist_executions;
DROP POLICY IF EXISTS "checklist_executions delete admin" ON public.checklist_executions;

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
CREATE POLICY "checklist_executions delete admin"
ON public.checklist_executions FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

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

-- Quality audits can be executed by admin, gestor and auditor.
DROP POLICY IF EXISTS "quality_audits insert admin auditor" ON public.quality_audits;
DROP POLICY IF EXISTS "quality_audits update admin auditor owner" ON public.quality_audits;
DROP POLICY IF EXISTS "quality_audits delete admin" ON public.quality_audits;
DROP POLICY IF EXISTS "quality_audits insert admin gestor auditor" ON public.quality_audits;
DROP POLICY IF EXISTS "quality_audits update admin gestor auditor owner" ON public.quality_audits;

CREATE POLICY "quality_audits insert admin gestor auditor"
ON public.quality_audits FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR (
    auditor_id = auth.uid()
    AND (
      public.has_role(auth.uid(), 'gestor'::public.app_role)
      OR public.has_role(auth.uid(), 'auditor'::public.app_role)
    )
  )
);
CREATE POLICY "quality_audits update admin gestor auditor owner"
ON public.quality_audits FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR (
    auditor_id = auth.uid()
    AND (
      public.has_role(auth.uid(), 'gestor'::public.app_role)
      OR public.has_role(auth.uid(), 'auditor'::public.app_role)
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
    )
  )
);
CREATE POLICY "quality_audits delete admin"
ON public.quality_audits FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "quality_audit_sectors write admin auditor owner" ON public.quality_audit_sectors;
DROP POLICY IF EXISTS "quality_audit_answers write admin auditor owner" ON public.quality_audit_answers;
DROP POLICY IF EXISTS "quality_audit_sectors write admin gestor auditor owner" ON public.quality_audit_sectors;
DROP POLICY IF EXISTS "quality_audit_answers write admin gestor auditor owner" ON public.quality_audit_answers;

CREATE POLICY "quality_audit_sectors write admin gestor auditor owner"
ON public.quality_audit_sectors FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.quality_audits a
    WHERE a.id = quality_audit_sectors.audit_id
      AND a.auditor_id = auth.uid()
      AND (
        public.has_role(auth.uid(), 'gestor'::public.app_role)
        OR public.has_role(auth.uid(), 'auditor'::public.app_role)
      )
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.quality_audits a
    WHERE a.id = quality_audit_sectors.audit_id
      AND a.auditor_id = auth.uid()
      AND (
        public.has_role(auth.uid(), 'gestor'::public.app_role)
        OR public.has_role(auth.uid(), 'auditor'::public.app_role)
      )
  )
);

CREATE POLICY "quality_audit_answers write admin gestor auditor owner"
ON public.quality_audit_answers FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.quality_audits a
    WHERE a.id = quality_audit_answers.audit_id
      AND a.auditor_id = auth.uid()
      AND (
        public.has_role(auth.uid(), 'gestor'::public.app_role)
        OR public.has_role(auth.uid(), 'auditor'::public.app_role)
      )
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.quality_audits a
    WHERE a.id = quality_audit_answers.audit_id
      AND a.auditor_id = auth.uid()
      AND (
        public.has_role(auth.uid(), 'gestor'::public.app_role)
        OR public.has_role(auth.uid(), 'auditor'::public.app_role)
      )
  )
);

-- Action plan editing is operational/management work, not an operador feature.
DROP POLICY IF EXISTS "plans insert own" ON public.action_plans;
DROP POLICY IF EXISTS "plans update own responsible or admin" ON public.action_plans;
DROP POLICY IF EXISTS "plans delete admin" ON public.action_plans;
DROP POLICY IF EXISTS "action_plans insert admin gestor auditor owner" ON public.action_plans;
DROP POLICY IF EXISTS "action_plans update admin gestor auditor owner" ON public.action_plans;
DROP POLICY IF EXISTS "action_plans delete admin" ON public.action_plans;

CREATE POLICY "action_plans insert admin gestor auditor owner"
ON public.action_plans FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR (
    created_by = auth.uid()
    AND (
      public.has_role(auth.uid(), 'gestor'::public.app_role)
      OR public.has_role(auth.uid(), 'auditor'::public.app_role)
    )
  )
);
CREATE POLICY "action_plans update admin gestor auditor owner"
ON public.action_plans FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR (
    (created_by = auth.uid() OR responsible_user_id = auth.uid())
    AND (
      public.has_role(auth.uid(), 'gestor'::public.app_role)
      OR public.has_role(auth.uid(), 'auditor'::public.app_role)
    )
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR (
    (created_by = auth.uid() OR responsible_user_id = auth.uid())
    AND (
      public.has_role(auth.uid(), 'gestor'::public.app_role)
      OR public.has_role(auth.uid(), 'auditor'::public.app_role)
    )
  )
);
CREATE POLICY "action_plans delete admin"
ON public.action_plans FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));
