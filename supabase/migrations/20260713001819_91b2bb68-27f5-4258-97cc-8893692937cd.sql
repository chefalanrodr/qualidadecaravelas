
DROP POLICY IF EXISTS "logos read auth" ON storage.objects;
CREATE POLICY "logos read auth" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'logos');

DROP POLICY IF EXISTS "logos admin insert" ON storage.objects;
CREATE POLICY "logos admin insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'logos' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "logos admin update" ON storage.objects;
CREATE POLICY "logos admin update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'logos' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "logos admin delete" ON storage.objects;
CREATE POLICY "logos admin delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'logos' AND public.has_role(auth.uid(), 'admin'));
