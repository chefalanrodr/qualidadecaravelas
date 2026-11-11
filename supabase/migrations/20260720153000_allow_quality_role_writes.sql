-- Fix quality audit writes for authorized quality roles.
-- The app lets admin, gestor and auditor work on quality audits; RLS must not
-- depend on the audit creator when saving answers or finishing sector scores.

DROP POLICY IF EXISTS "qau auth all" ON public.quality_audits;
DROP POLICY IF EXISTS "insert audits" ON public.quality_audits;
DROP POLICY IF EXISTS "update audits" ON public.quality_audits;
DROP POLICY IF EXISTS "quality_audits insert admin auditor" ON public.quality_audits;
DROP POLICY IF EXISTS "quality_audits update admin auditor owner" ON public.quality_audits;
DROP POLICY IF EXISTS "quality_audits insert admin gestor auditor" ON public.quality_audits;
DROP POLICY IF EXISTS "quality_audits update admin gestor auditor owner" ON public.quality_audits;
DROP POLICY IF EXISTS "quality_audits insert quality roles" ON public.quality_audits;
DROP POLICY IF EXISTS "quality_audits update quality roles" ON public.quality_audits;

CREATE POLICY "quality_audits insert quality roles"
ON public.quality_audits FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'gestor'::public.app_role)
  OR public.has_role(auth.uid(), 'auditor'::public.app_role)
);

CREATE POLICY "quality_audits update quality roles"
ON public.quality_audits FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'gestor'::public.app_role)
  OR public.has_role(auth.uid(), 'auditor'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'gestor'::public.app_role)
  OR public.has_role(auth.uid(), 'auditor'::public.app_role)
);

DROP POLICY IF EXISTS "qas auth all" ON public.quality_audit_sectors;
DROP POLICY IF EXISTS "write qas" ON public.quality_audit_sectors;
DROP POLICY IF EXISTS "quality_audit_sectors write admin auditor owner" ON public.quality_audit_sectors;
DROP POLICY IF EXISTS "quality_audit_sectors write admin gestor auditor owner" ON public.quality_audit_sectors;
DROP POLICY IF EXISTS "quality_audit_sectors write quality roles insert" ON public.quality_audit_sectors;
DROP POLICY IF EXISTS "quality_audit_sectors write quality roles update" ON public.quality_audit_sectors;
DROP POLICY IF EXISTS "quality_audit_sectors write quality roles delete" ON public.quality_audit_sectors;

CREATE POLICY "quality_audit_sectors write quality roles insert"
ON public.quality_audit_sectors FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'gestor'::public.app_role)
  OR public.has_role(auth.uid(), 'auditor'::public.app_role)
);

CREATE POLICY "quality_audit_sectors write quality roles update"
ON public.quality_audit_sectors FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'gestor'::public.app_role)
  OR public.has_role(auth.uid(), 'auditor'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'gestor'::public.app_role)
  OR public.has_role(auth.uid(), 'auditor'::public.app_role)
);

CREATE POLICY "quality_audit_sectors write quality roles delete"
ON public.quality_audit_sectors FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'gestor'::public.app_role)
  OR public.has_role(auth.uid(), 'auditor'::public.app_role)
);

DROP POLICY IF EXISTS "qaa auth all" ON public.quality_audit_answers;
DROP POLICY IF EXISTS "write qans" ON public.quality_audit_answers;
DROP POLICY IF EXISTS "quality_audit_answers write admin auditor owner" ON public.quality_audit_answers;
DROP POLICY IF EXISTS "quality_audit_answers write admin gestor auditor owner" ON public.quality_audit_answers;
DROP POLICY IF EXISTS "quality_audit_answers write quality roles insert" ON public.quality_audit_answers;
DROP POLICY IF EXISTS "quality_audit_answers write quality roles update" ON public.quality_audit_answers;
DROP POLICY IF EXISTS "quality_audit_answers write quality roles delete" ON public.quality_audit_answers;

CREATE POLICY "quality_audit_answers write quality roles insert"
ON public.quality_audit_answers FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'gestor'::public.app_role)
  OR public.has_role(auth.uid(), 'auditor'::public.app_role)
);

CREATE POLICY "quality_audit_answers write quality roles update"
ON public.quality_audit_answers FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'gestor'::public.app_role)
  OR public.has_role(auth.uid(), 'auditor'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'gestor'::public.app_role)
  OR public.has_role(auth.uid(), 'auditor'::public.app_role)
);

CREATE POLICY "quality_audit_answers write quality roles delete"
ON public.quality_audit_answers FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'gestor'::public.app_role)
  OR public.has_role(auth.uid(), 'auditor'::public.app_role)
);
