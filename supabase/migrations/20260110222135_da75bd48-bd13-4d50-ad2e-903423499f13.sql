-- Drop the current SELECT policy
DROP POLICY IF EXISTS "Users can view own properties" ON properties;

-- Create new policy allowing all authenticated users to view all properties
CREATE POLICY "Authenticated users can view all properties"
ON properties FOR SELECT
TO authenticated
USING (true);

-- Keep insert/update/delete restricted to owner (already in place)