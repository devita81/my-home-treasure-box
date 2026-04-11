
-- Fix property_documents SELECT policy: restrict to owner or admin
DROP POLICY IF EXISTS "Authenticated users can view property documents" ON public.property_documents;
CREATE POLICY "Users can view own property documents or admins"
  ON public.property_documents
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = uploaded_by
    OR has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.properties
      WHERE properties.id = property_documents.property_id
        AND properties.user_id = auth.uid()
    )
  );

-- Add missing UPDATE policy on property_documents
CREATE POLICY "Users can update own documents or admins"
  ON public.property_documents
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = uploaded_by
    OR has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    auth.uid() = uploaded_by
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- Fix storage policies for property-documents bucket
DROP POLICY IF EXISTS "Authenticated users can upload property documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view property documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update property documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete property documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own property files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own property files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own property files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own property files" ON storage.objects;

-- Storage SELECT: only owner or admin
CREATE POLICY "Users can view own property files"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'property-documents'
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.property_documents pd
        JOIN public.properties p ON p.id = pd.property_id
        WHERE pd.file_path = name
          AND (pd.uploaded_by = auth.uid() OR p.user_id = auth.uid())
      )
    )
  );

-- Storage INSERT: authenticated users can upload to their own folder
CREATE POLICY "Users can upload own property files"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'property-documents'
    AND auth.role() = 'authenticated'
  );

-- Storage UPDATE: only owner or admin
CREATE POLICY "Users can update own property files"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'property-documents'
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.property_documents pd
        WHERE pd.file_path = name
          AND pd.uploaded_by = auth.uid()
      )
    )
  );

-- Storage DELETE: only owner or admin
CREATE POLICY "Users can delete own property files"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'property-documents'
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.property_documents pd
        WHERE pd.file_path = name
          AND pd.uploaded_by = auth.uid()
      )
    )
  );
