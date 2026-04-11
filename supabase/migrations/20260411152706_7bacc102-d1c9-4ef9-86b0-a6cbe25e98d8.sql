
-- Step 1: Drop ALL policies that depend on old has_role(uuid, app_role)
DROP POLICY IF EXISTS "Users can view own properties or admins view all" ON public.properties;
DROP POLICY IF EXISTS "Users can update own properties or admins can update any" ON public.properties;
DROP POLICY IF EXISTS "Users can delete own properties or admins can delete any" ON public.properties;
DROP POLICY IF EXISTS "Users can view own property documents or admins" ON public.property_documents;
DROP POLICY IF EXISTS "Users can update own documents or admins" ON public.property_documents;
DROP POLICY IF EXISTS "Users can delete own documents or admins" ON public.property_documents;
DROP POLICY IF EXISTS "Only admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own property files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own property files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own property files" ON storage.objects;

-- Step 2: Drop old 2-arg function, then create new 1-arg version
DROP FUNCTION IF EXISTS public.has_role(uuid, app_role);

CREATE OR REPLACE FUNCTION public.has_role(_role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = _role
  )
$$;

-- Step 3: Recreate all policies using new has_role(role)

-- properties
CREATE POLICY "Users can view own properties or admins view all"
  ON public.properties FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role('admin'::app_role));

CREATE POLICY "Users can update own properties or admins can update any"
  ON public.properties FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role('admin'::app_role))
  WITH CHECK (auth.uid() = user_id OR public.has_role('admin'::app_role));

CREATE POLICY "Users can delete own properties or admins can delete any"
  ON public.properties FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role('admin'::app_role));

-- property_documents
CREATE POLICY "Users can view own property documents or admins"
  ON public.property_documents FOR SELECT TO authenticated
  USING (
    auth.uid() = uploaded_by
    OR public.has_role('admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.properties
      WHERE properties.id = property_documents.property_id
        AND properties.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own documents or admins"
  ON public.property_documents FOR UPDATE TO authenticated
  USING (auth.uid() = uploaded_by OR public.has_role('admin'::app_role))
  WITH CHECK (auth.uid() = uploaded_by OR public.has_role('admin'::app_role));

CREATE POLICY "Users can delete own documents or admins"
  ON public.property_documents FOR DELETE TO authenticated
  USING (auth.uid() = uploaded_by OR public.has_role('admin'::app_role));

-- user_roles
CREATE POLICY "Only admins can insert roles"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role('admin'::app_role));

CREATE POLICY "Only admins can update roles"
  ON public.user_roles FOR UPDATE TO authenticated
  USING (public.has_role('admin'::app_role))
  WITH CHECK (public.has_role('admin'::app_role));

CREATE POLICY "Only admins can delete roles"
  ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role('admin'::app_role));

-- storage
CREATE POLICY "Users can view own property files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'property-documents'
    AND (
      public.has_role('admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.property_documents pd
        JOIN public.properties p ON p.id = pd.property_id
        WHERE pd.file_path = name
          AND (pd.uploaded_by = auth.uid() OR p.user_id = auth.uid())
      )
    )
  );

CREATE POLICY "Users can update own property files"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'property-documents'
    AND (
      public.has_role('admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.property_documents pd
        WHERE pd.file_path = name AND pd.uploaded_by = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete own property files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'property-documents'
    AND (
      public.has_role('admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.property_documents pd
        WHERE pd.file_path = name AND pd.uploaded_by = auth.uid()
      )
    )
  );

-- Step 4: Add validation trigger for photos array
CREATE OR REPLACE FUNCTION public.validate_photo_urls()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  url TEXT;
BEGIN
  IF NEW.photos IS NOT NULL AND array_length(NEW.photos, 1) IS NOT NULL THEN
    IF array_length(NEW.photos, 1) > 50 THEN
      RAISE EXCEPTION 'Máximo de 50 fotos permitidas';
    END IF;
    FOREACH url IN ARRAY NEW.photos LOOP
      IF length(url) = 0 THEN
        CONTINUE;
      END IF;
      IF length(url) > 2000 THEN
        RAISE EXCEPTION 'URL de foto muito longa (máximo 2000 caracteres)';
      END IF;
      IF NOT (url ~* '^https://') THEN
        RAISE EXCEPTION 'Apenas URLs HTTPS são permitidas para fotos';
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_property_photos
  BEFORE INSERT OR UPDATE ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_photo_urls();
