ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS ai_venda_min numeric,
  ADD COLUMN IF NOT EXISTS ai_venda_med numeric,
  ADD COLUMN IF NOT EXISTS ai_venda_max numeric,
  ADD COLUMN IF NOT EXISTS ai_aluguel_min numeric,
  ADD COLUMN IF NOT EXISTS ai_aluguel_med numeric,
  ADD COLUMN IF NOT EXISTS ai_aluguel_max numeric;