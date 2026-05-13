-- Retry-apply das colunas ai_deep_research_* — a migration original
-- (20260511130000_add_ai_deep_research_to_properties.sql) está no
-- repo desde o merge do v27 mas o Lovable não a rodou no banco
-- gerenciado. Sintoma confirmado: o frontend tenta um UPDATE com
-- essas colunas e o PostgREST devolve 400 Bad Request (porque a
-- coluna não existe).
--
-- Esse arquivo é IDÊNTICO no efeito ao 20260511130000, só com
-- timestamp novo pra forçar o Lovable a detectar como migration
-- inédita e aplicá-la. Como o SQL usa IF NOT EXISTS, é totalmente
-- idempotente — se por acaso a primeira migration tiver rodado
-- depois de tudo, esta vira no-op.
--
-- Mesma técnica do v13 deployment marker que forçou o Lovable a
-- re-deployar a edge function chat-ia.

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS ai_deep_research_md TEXT,
  ADD COLUMN IF NOT EXISTS ai_deep_research_citations JSONB,
  ADD COLUMN IF NOT EXISTS ai_deep_research_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.properties.ai_deep_research_md IS
  'Relatório markdown completo da última Análise profunda (Claude + web_search). NULL quando nunca gerada.';

COMMENT ON COLUMN public.properties.ai_deep_research_citations IS
  'Array JSON [{url, title}] das fontes citadas pelo modelo na última análise.';

COMMENT ON COLUMN public.properties.ai_deep_research_updated_at IS
  'Timestamp da última Análise profunda gerada — mostrado na UI como "Última análise: ...".';
