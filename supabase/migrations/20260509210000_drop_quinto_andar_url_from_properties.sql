-- Drop the now-unused `quinto_andar_url` column.
--
-- Originally added to support a manual condoId override when QuintoAndar
-- search was unreliable (PR feat/qa-condo-id-hybrid). The whole QA
-- provider was subsequently removed from the app, so this column has
-- zero readers in src/, edge functions, or generated types. Cleanup-only.

ALTER TABLE public.properties
  DROP COLUMN IF EXISTS quinto_andar_url;
