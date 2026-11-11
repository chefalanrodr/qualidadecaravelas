-- Reapply quality configuration permissions for the current access matrix.
-- Auditors must be able to activate/deactivate and edit quality audit areas,
-- sectors and questions from the Quality Audit settings screen.

DROP POLICY IF EXISTS "quality_areas configure admin gestor insert" ON public.quality_areas;
DROP POLICY IF EXISTS "quality_areas configure admin gestor update" ON public.quality_areas;
DROP POLICY IF EXISTS "quality_areas configure admin gestor delete" ON public.quality_areas;
DROP POLICY IF EXISTS "quality_areas configure admin gestor auditor insert" ON public.quality_areas;
DROP POLICY IF EXISTS "quality_areas configure admin gestor auditor update" ON public.quality_areas;
DROP POLICY IF EXISTS "quality_areas configure admin gestor auditor delete" ON public.quality_areas;

CREATE POLICY "quality_areas configure admin gestor auditor insert"
ON public.quality_areas FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'gestor'::public.app_role)
  OR public.has_role(auth.uid(), 'auditor'::public.app_role)
);

CREATE POLICY "quality_areas configure admin gestor auditor update"
ON public.quality_areas FOR UPDATE TO authenticated
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

CREATE POLICY "quality_areas configure admin gestor auditor delete"
ON public.quality_areas FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'gestor'::public.app_role)
  OR public.has_role(auth.uid(), 'auditor'::public.app_role)
);

DROP POLICY IF EXISTS "quality_sectors configure admin gestor insert" ON public.quality_sectors;
DROP POLICY IF EXISTS "quality_sectors configure admin gestor update" ON public.quality_sectors;
DROP POLICY IF EXISTS "quality_sectors configure admin gestor delete" ON public.quality_sectors;
DROP POLICY IF EXISTS "quality_sectors configure admin gestor auditor insert" ON public.quality_sectors;
DROP POLICY IF EXISTS "quality_sectors configure admin gestor auditor update" ON public.quality_sectors;
DROP POLICY IF EXISTS "quality_sectors configure admin gestor auditor delete" ON public.quality_sectors;

CREATE POLICY "quality_sectors configure admin gestor auditor insert"
ON public.quality_sectors FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'gestor'::public.app_role)
  OR public.has_role(auth.uid(), 'auditor'::public.app_role)
);

CREATE POLICY "quality_sectors configure admin gestor auditor update"
ON public.quality_sectors FOR UPDATE TO authenticated
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

CREATE POLICY "quality_sectors configure admin gestor auditor delete"
ON public.quality_sectors FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'gestor'::public.app_role)
  OR public.has_role(auth.uid(), 'auditor'::public.app_role)
);

DROP POLICY IF EXISTS "quality_items configure admin gestor insert" ON public.quality_items;
DROP POLICY IF EXISTS "quality_items configure admin gestor update" ON public.quality_items;
DROP POLICY IF EXISTS "quality_items configure admin gestor delete" ON public.quality_items;
DROP POLICY IF EXISTS "quality_items configure admin gestor auditor insert" ON public.quality_items;
DROP POLICY IF EXISTS "quality_items configure admin gestor auditor update" ON public.quality_items;
DROP POLICY IF EXISTS "quality_items configure admin gestor auditor delete" ON public.quality_items;

CREATE POLICY "quality_items configure admin gestor auditor insert"
ON public.quality_items FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'gestor'::public.app_role)
  OR public.has_role(auth.uid(), 'auditor'::public.app_role)
);

CREATE POLICY "quality_items configure admin gestor auditor update"
ON public.quality_items FOR UPDATE TO authenticated
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

CREATE POLICY "quality_items configure admin gestor auditor delete"
ON public.quality_items FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'gestor'::public.app_role)
  OR public.has_role(auth.uid(), 'auditor'::public.app_role)
);
