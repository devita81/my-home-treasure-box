-- Fix 1: Restrict properties SELECT to owner + admin
DROP POLICY "Authenticated users can view all properties" ON properties;

CREATE POLICY "Users can view own properties or admins view all"
  ON properties FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- Fix 2: Add explicit write-protection policies on user_roles (admin-only)
CREATE POLICY "Only admins can insert roles"
  ON user_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can update roles"
  ON user_roles FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete roles"
  ON user_roles FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));