
DROP POLICY IF EXISTS "Authenticated read attachments" ON storage.objects;
DROP POLICY IF EXISTS "attachments read auth" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload attachments" ON storage.objects;

CREATE POLICY "attachments select owner or staff"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'attachments'
  AND (
    owner = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gestor')
    OR public.has_role(auth.uid(), 'auditor')
  )
);
