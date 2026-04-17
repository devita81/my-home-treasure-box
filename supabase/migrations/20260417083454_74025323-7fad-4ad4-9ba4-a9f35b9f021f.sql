ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS ai_market_estimate TEXT,
ADD COLUMN IF NOT EXISTS ai_market_estimate_updated_at TIMESTAMP WITH TIME ZONE;