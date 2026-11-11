DROP POLICY IF EXISTS "profiles select self or admin" ON public.profiles;
CREATE POLICY "profiles select self or admin"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = id
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'gestor'::public.app_role)
);