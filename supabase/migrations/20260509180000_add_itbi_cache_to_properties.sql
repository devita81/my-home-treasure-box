-- Cached ITBI transaction history for the property's exact building.
-- Filled by clicking "Atualizar" on the property's ITBI block, frozen
-- between clicks so the user always sees the same data they saw last
-- time without paying for another search.
--
-- Shape:
--   {
--     "fetched_at": "2026-05-09T18:00:00.000Z",
--     "params": { "tipos": ["apartamento"], "logradouro": "Rua Marc Chagall", "numero": "397" },
--     "results": [ ...itbi_transactions rows... ]
--   }

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS itbi_cache JSONB;
