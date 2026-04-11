
-- Fix 1: Restrict storage INSERT to user's own folder path
DROP POLICY IF EXISTS "Users can upload own property files" ON storage.objects;
CREATE POLICY "Users can upload own property files"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'property-documents'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Fix 2: Add WITH CHECK to storage UPDATE policy
DROP POLICY IF EXISTS "Users can update own property files" ON storage.objects;
CREATE POLICY "Users can update own property files"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'property-documents'
    AND (
      public.has_role('admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.property_documents pd
        WHERE pd.file_path = name AND pd.uploaded_by = auth.uid()
      )
    )
  )
  WITH CHECK (
    bucket_id = 'property-documents'
    AND (
      public.has_role('admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.property_documents pd
        WHERE pd.file_path = name AND pd.uploaded_by = auth.uid()
      )
    )
  );
