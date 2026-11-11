ALTER TABLE public.attachments
  ADD COLUMN IF NOT EXISTS thumbnail_path text,
  ADD COLUMN IF NOT EXISTS mime_type text,
  ADD COLUMN IF NOT EXISTS size_bytes bigint,
  ADD COLUMN IF NOT EXISTS thumbnail_size_bytes bigint;

CREATE INDEX IF NOT EXISTS idx_attachments_thumbnail_path
  ON public.attachments(thumbnail_path)
  WHERE thumbnail_path IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.quality_report_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id uuid NOT NULL REFERENCES public.quality_audits(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  generated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (audit_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quality_report_snapshots TO authenticated;
GRANT ALL ON public.quality_report_snapshots TO service_role;

ALTER TABLE public.quality_report_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quality_report_snapshots read auth" ON public.quality_report_snapshots;
DROP POLICY IF EXISTS "quality_report_snapshots insert quality roles" ON public.quality_report_snapshots;
DROP POLICY IF EXISTS "quality_report_snapshots update quality roles" ON public.quality_report_snapshots;
DROP POLICY IF EXISTS "quality_report_snapshots delete quality roles" ON public.quality_report_snapshots;

CREATE POLICY "quality_report_snapshots read auth"
ON public.quality_report_snapshots FOR SELECT TO authenticated
USING (true);

CREATE POLICY "quality_report_snapshots insert quality roles"
ON public.quality_report_snapshots FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'gestor'::public.app_role)
  OR public.has_role(auth.uid(), 'auditor'::public.app_role)
);

CREATE POLICY "quality_report_snapshots update quality roles"
ON public.quality_report_snapshots FOR UPDATE TO authenticated
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

CREATE POLICY "quality_report_snapshots delete quality roles"
ON public.quality_report_snapshots FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'gestor'::public.app_role)
  OR public.has_role(auth.uid(), 'auditor'::public.app_role)
);
