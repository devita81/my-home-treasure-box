-- Drop insecure public policies
DROP POLICY IF EXISTS "Allow public read access" ON properties;
DROP POLICY IF EXISTS "Allow public insert" ON properties;
DROP POLICY IF EXISTS "Allow public update" ON properties;
DROP POLICY IF EXISTS "Allow public delete" ON properties;

-- Create secure user-scoped policies
CREATE POLICY "Users can view own properties"
ON properties FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own properties"
ON properties FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own properties"
ON properties FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own properties"
ON properties FOR DELETE
TO authenticated
USING (auth.uid() = user_id);