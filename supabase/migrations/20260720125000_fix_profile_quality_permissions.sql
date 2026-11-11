-- Align app roles with the UI:
-- - every authenticated user can read their own role
-- - admin/gestor configure checklist and quality structures
-- - admin/auditor execute quality audits
-- - authenticated users can create action plans they own

DROP POLICY IF EXISTS "roles select self" ON public.user_roles;
DROP POLICY IF EXISTS "roles select admin" ON public.user_roles;
DROP POLICY IF EXISTS "roles read own or admin" ON public.user_roles;
CREATE POLICY "roles read own or admin"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "qa auth all" ON public.quality_areas;
DROP POLICY IF EXISTS "qs auth all" ON public.quality_sectors;
DROP POLICY IF EXISTS "qi auth all" ON public.quality_items;
DROP POLICY IF EXISTS "manage areas admin" ON public.quality_areas;
DROP POLICY IF EXISTS "manage qsectors admin" ON public.quality_sectors;
DROP POLICY IF EXISTS "manage qitems admin" ON public.quality_items;
DROP POLICY IF EXISTS "quality_areas write admin/gestor insert" ON public.quality_areas;
DROP POLICY IF EXISTS "quality_areas write admin/gestor update" ON public.quality_areas;
DROP POLICY IF EXISTS "quality_areas write admin/gestor delete" ON public.quality_areas;
DROP POLICY IF EXISTS "quality_areas configure admin gestor insert" ON public.quality_areas;
DROP POLICY IF EXISTS "quality_areas configure admin gestor update" ON public.quality_areas;
DROP POLICY IF EXISTS "quality_areas configure admin gestor delete" ON public.quality_areas;
DROP POLICY IF EXISTS "quality_sectors write admin/gestor insert" ON public.quality_sectors;
DROP POLICY IF EXISTS "quality_sectors write admin/gestor update" ON public.quality_sectors;
DROP POLICY IF EXISTS "quality_sectors write admin/gestor delete" ON public.quality_sectors;
DROP POLICY IF EXISTS "quality_sectors configure admin gestor insert" ON public.quality_sectors;
DROP POLICY IF EXISTS "quality_sectors configure admin gestor update" ON public.quality_sectors;
DROP POLICY IF EXISTS "quality_sectors configure admin gestor delete" ON public.quality_sectors;
DROP POLICY IF EXISTS "quality_items write admin/gestor insert" ON public.quality_items;
DROP POLICY IF EXISTS "quality_items write admin/gestor update" ON public.quality_items;
DROP POLICY IF EXISTS "quality_items write admin/gestor delete" ON public.quality_items;
DROP POLICY IF EXISTS "quality_items configure admin gestor insert" ON public.quality_items;
DROP POLICY IF EXISTS "quality_items configure admin gestor update" ON public.quality_items;
DROP POLICY IF EXISTS "quality_items configure admin gestor delete" ON public.quality_items;
DROP POLICY IF EXISTS "quality_areas read auth" ON public.quality_areas;
DROP POLICY IF EXISTS "quality_sectors read auth" ON public.quality_sectors;
DROP POLICY IF EXISTS "quality_items read auth" ON public.quality_items;

CREATE POLICY "quality_areas read auth"
ON public.quality_areas FOR SELECT TO authenticated
USING (true);
CREATE POLICY "quality_sectors read auth"
ON public.quality_sectors FOR SELECT TO authenticated
USING (true);
CREATE POLICY "quality_items read auth"
ON public.quality_items FOR SELECT TO authenticated
USING (true);

CREATE POLICY "quality_areas configure admin gestor insert"
ON public.quality_areas FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'gestor'::public.app_role));
CREATE POLICY "quality_areas configure admin gestor update"
ON public.quality_areas FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'gestor'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'gestor'::public.app_role));
CREATE POLICY "quality_areas configure admin gestor delete"
ON public.quality_areas FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'gestor'::public.app_role));

CREATE POLICY "quality_sectors configure admin gestor insert"
ON public.quality_sectors FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'gestor'::public.app_role));
CREATE POLICY "quality_sectors configure admin gestor update"
ON public.quality_sectors FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'gestor'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'gestor'::public.app_role));
CREATE POLICY "quality_sectors configure admin gestor delete"
ON public.quality_sectors FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'gestor'::public.app_role));

CREATE POLICY "quality_items configure admin gestor insert"
ON public.quality_items FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'gestor'::public.app_role));
CREATE POLICY "quality_items configure admin gestor update"
ON public.quality_items FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'gestor'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'gestor'::public.app_role));
CREATE POLICY "quality_items configure admin gestor delete"
ON public.quality_items FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'gestor'::public.app_role));

DROP POLICY IF EXISTS "qau auth all" ON public.quality_audits;
DROP POLICY IF EXISTS "qas auth all" ON public.quality_audit_sectors;
DROP POLICY IF EXISTS "qaa auth all" ON public.quality_audit_answers;
DROP POLICY IF EXISTS "insert audits" ON public.quality_audits;
DROP POLICY IF EXISTS "update audits" ON public.quality_audits;
DROP POLICY IF EXISTS "delete audits admin" ON public.quality_audits;
DROP POLICY IF EXISTS "quality_audits write admin/gestor insert" ON public.quality_audits;
DROP POLICY IF EXISTS "quality_audits write admin/gestor update" ON public.quality_audits;
DROP POLICY IF EXISTS "quality_audits write admin/gestor delete" ON public.quality_audits;
DROP POLICY IF EXISTS "quality_audits insert admin auditor" ON public.quality_audits;
DROP POLICY IF EXISTS "quality_audits update admin auditor owner" ON public.quality_audits;
DROP POLICY IF EXISTS "quality_audits delete admin" ON public.quality_audits;
DROP POLICY IF EXISTS "write qas" ON public.quality_audit_sectors;
DROP POLICY IF EXISTS "write qans" ON public.quality_audit_answers;
DROP POLICY IF EXISTS "quality_audit_sectors write admin/gestor insert" ON public.quality_audit_sectors;
DROP POLICY IF EXISTS "quality_audit_sectors write admin/gestor update" ON public.quality_audit_sectors;
DROP POLICY IF EXISTS "quality_audit_sectors write admin/gestor delete" ON public.quality_audit_sectors;
DROP POLICY IF EXISTS "quality_audit_sectors write admin auditor owner" ON public.quality_audit_sectors;
DROP POLICY IF EXISTS "quality_audit_answers write admin/gestor insert" ON public.quality_audit_answers;
DROP POLICY IF EXISTS "quality_audit_answers write admin/gestor update" ON public.quality_audit_answers;
DROP POLICY IF EXISTS "quality_audit_answers write admin/gestor delete" ON public.quality_audit_answers;
DROP POLICY IF EXISTS "quality_audit_answers write admin auditor owner" ON public.quality_audit_answers;
DROP POLICY IF EXISTS "quality_audits read auth" ON public.quality_audits;
DROP POLICY IF EXISTS "quality_audit_sectors read auth" ON public.quality_audit_sectors;
DROP POLICY IF EXISTS "quality_audit_answers read auth" ON public.quality_audit_answers;

CREATE POLICY "quality_audits read auth"
ON public.quality_audits FOR SELECT TO authenticated
USING (true);
CREATE POLICY "quality_audit_sectors read auth"
ON public.quality_audit_sectors FOR SELECT TO authenticated
USING (true);
CREATE POLICY "quality_audit_answers read auth"
ON public.quality_audit_answers FOR SELECT TO authenticated
USING (true);

CREATE POLICY "quality_audits insert admin auditor"
ON public.quality_audits
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR (public.has_role(auth.uid(), 'auditor'::public.app_role) AND auditor_id = auth.uid())
);
CREATE POLICY "quality_audits update admin auditor owner"
ON public.quality_audits
FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR (public.has_role(auth.uid(), 'auditor'::public.app_role) AND auditor_id = auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR (public.has_role(auth.uid(), 'auditor'::public.app_role) AND auditor_id = auth.uid())
);
CREATE POLICY "quality_audits delete admin"
ON public.quality_audits
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "quality_audit_sectors write admin auditor owner"
ON public.quality_audit_sectors
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.quality_audits a
    WHERE a.id = quality_audit_sectors.audit_id
      AND a.auditor_id = auth.uid()
      AND public.has_role(auth.uid(), 'auditor'::public.app_role)
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.quality_audits a
    WHERE a.id = quality_audit_sectors.audit_id
      AND a.auditor_id = auth.uid()
      AND public.has_role(auth.uid(), 'auditor'::public.app_role)
  )
);

CREATE POLICY "quality_audit_answers write admin auditor owner"
ON public.quality_audit_answers
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.quality_audits a
    WHERE a.id = quality_audit_answers.audit_id
      AND a.auditor_id = auth.uid()
      AND public.has_role(auth.uid(), 'auditor'::public.app_role)
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.quality_audits a
    WHERE a.id = quality_audit_answers.audit_id
      AND a.auditor_id = auth.uid()
      AND public.has_role(auth.uid(), 'auditor'::public.app_role)
  )
);

DROP POLICY IF EXISTS "ap auth all" ON public.action_plans;
DROP POLICY IF EXISTS "plans insert auth" ON public.action_plans;
DROP POLICY IF EXISTS "plans update own or admin" ON public.action_plans;
DROP POLICY IF EXISTS "action_plans write admin/gestor insert" ON public.action_plans;
DROP POLICY IF EXISTS "action_plans write admin/gestor update" ON public.action_plans;
DROP POLICY IF EXISTS "action_plans write admin/gestor delete" ON public.action_plans;
DROP POLICY IF EXISTS "plans read auth" ON public.action_plans;
DROP POLICY IF EXISTS "action_plans read auth" ON public.action_plans;
DROP POLICY IF EXISTS "plans insert own" ON public.action_plans;
DROP POLICY IF EXISTS "plans update own responsible or admin" ON public.action_plans;
DROP POLICY IF EXISTS "plans delete admin" ON public.action_plans;
CREATE POLICY "action_plans read auth"
ON public.action_plans
FOR SELECT TO authenticated
USING (true);
CREATE POLICY "plans insert own"
ON public.action_plans
FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "plans update own responsible or admin"
ON public.action_plans
FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR responsible_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (created_by = auth.uid() OR responsible_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "plans delete admin"
ON public.action_plans
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));
