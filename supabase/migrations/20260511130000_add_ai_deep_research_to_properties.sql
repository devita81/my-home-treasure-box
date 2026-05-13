-- Adiciona 3 colunas em `properties` pra persistir a feature
-- "Análise profunda" (Claude Sonnet 4.5 + web_search via CF Worker).
--
-- Sem isso, a análise vivia só em localStorage no client — perdia ao
-- trocar dispositivo/browser. Com persistência:
--   • Última análise fica salva no banco
--   • Aparece automaticamente pra qualquer dispositivo do mesmo user
--   • "Refazer" sobrescreve as 3 colunas
--   • Imóvel da Pesquisa pontual (avulsa, sem id) NÃO grava — só
--     pré-cadastrados persistem.
--
-- IF NOT EXISTS torna idempotente. Não há FK nem trigger.

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
