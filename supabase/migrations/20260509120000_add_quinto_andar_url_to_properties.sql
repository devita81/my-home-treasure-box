-- Optional manual override: a QuintoAndar `/condominio/{slug}` URL
-- pointing at the user's exact building. When set, the listings edge
-- function bypasses the geo-based search entirely and uses
-- `condoIds: [<numeric id>]` for perfect per-building filtering.
--
-- The numeric condoId resolved from this URL is cached inside
-- `resolved_location.quinto_andar_condo_id` so we only fetch and
-- parse the page once per property.

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS quinto_andar_url TEXT;
