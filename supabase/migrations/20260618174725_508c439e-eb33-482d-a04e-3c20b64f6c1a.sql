
-- 1) property_balancete: remove the (property_id IS NULL) loophole that exposed
--    orphan financial rows (with CPF/tenant data) to every authenticated user.
DROP POLICY IF EXISTS "Users can view linked or own balancete or admins" ON public.property_balancete;

CREATE POLICY "Users can view linked or own balancete or admins"
ON public.property_balancete
FOR SELECT
TO authenticated
USING (
  has_role('admin'::app_role)
  OR user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = property_balancete.property_id
      AND p.user_id = auth.uid()
  )
);

-- 2) property_documents INSERT: also require ownership of the referenced
--    property_id (or admin), not only auth.uid() = uploaded_by.
DROP POLICY IF EXISTS "Authenticated users can insert property documents" ON public.property_documents;

CREATE POLICY "Authenticated users can insert property documents"
ON public.property_documents
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = uploaded_by
  AND (
    has_role('admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = property_documents.property_id
        AND p.user_id = auth.uid()
    )
  )
);

-- 3) properties.photos: cap array size at the DB layer (defense in depth).
ALTER TABLE public.properties
  DROP CONSTRAINT IF EXISTS photos_max_size;

ALTER TABLE public.properties
  ADD CONSTRAINT photos_max_size
  CHECK (photos IS NULL OR array_length(photos, 1) IS NULL OR array_length(photos, 1) <= 50);
