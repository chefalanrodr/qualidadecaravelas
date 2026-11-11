DROP POLICY IF EXISTS "quality_audits delete open quality roles" ON public.quality_audits;

CREATE POLICY "quality_audits delete open quality roles"
ON public.quality_audits FOR DELETE TO authenticated
USING (
  status = 'em_andamento'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gestor'::public.app_role)
    OR (
      auditor_id = auth.uid()
      AND public.has_role(auth.uid(), 'auditor'::public.app_role)
    )
  )
);
