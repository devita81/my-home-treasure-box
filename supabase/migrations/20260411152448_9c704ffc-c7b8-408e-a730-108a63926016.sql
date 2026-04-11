
-- Fix 1: Remove legacy overly-permissive storage policies
DROP POLICY IF EXISTS "Users can upload own property documents or admins" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own property documents or admins" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own property documents or admins" ON storage.objects;

-- Fix 2: Fix property_documents INSERT policy from 'public' to 'authenticated'
DROP POLICY IF EXISTS "Authenticated users can insert property documents" ON public.property_documents;
CREATE POLICY "Authenticated users can insert property documents"
  ON public.property_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = uploaded_by);

-- Fix 3: Fix property_documents DELETE policy from 'public' to 'authenticated'
DROP POLICY IF EXISTS "Users can delete own documents or admins" ON public.property_documents;
CREATE POLICY "Users can delete own documents or admins"
  ON public.property_documents
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = uploaded_by
    OR has_role(auth.uid(), 'admin'::app_role)
  );
