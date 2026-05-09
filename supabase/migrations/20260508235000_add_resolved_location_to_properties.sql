-- Add `resolved_location` JSONB to cache provider-specific location data
-- (computed once by an LLM resolver, then reused on every market search).
--
-- Shape:
--   {
--     "canonical": { street, number, neighborhood, zone, city, state, cep },
--     "zap": { addressStreet, addressNeighborhood, addressZone, addressLocationId, addressCity, addressState },
--     "quintoandar": { slug }
--   }
--
-- Nullable. NULL means "not resolved yet" — the listings edge functions
-- will lazily resolve and persist on first call.

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS resolved_location JSONB;

-- No index needed — we always look this up by primary key (`id`),
-- never query inside the JSON.
