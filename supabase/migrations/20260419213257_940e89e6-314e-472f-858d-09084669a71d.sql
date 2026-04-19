-- Habilitar extensões para busca por similaridade e remoção de acentos
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Função imutável para normalizar texto (sem acento, maiúsculo, sem pontuação extra)
CREATE OR REPLACE FUNCTION public.normalize_address_text(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_catalog
AS $$
  SELECT regexp_replace(
    regexp_replace(
      upper(public.unaccent('public.unaccent', coalesce(input, ''))),
      '\s+(APTO|APARTAMENTO|BLOCO|TORRE|ANDAR|CONJ|CONJUNTO|CASA|FUNDOS)\s*[A-Z0-9]*',
      ' ', 'g'
    ),
    '[^A-Z0-9 ]', ' ', 'g'
  )
$$;

-- Tabela enxuta de transações ITBI (14 colunas essenciais)
CREATE TABLE public.itbi_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sql_iptu text,
  natureza_transacao text,
  logradouro text NOT NULL,
  numero text,
  complemento text,
  bairro text,
  cep text,
  data_transacao date,
  valor_transacao numeric,
  valor_venal numeric,
  area_construida numeric,
  area_terreno numeric,
  ano_referencia integer NOT NULL,
  mes_referencia integer NOT NULL,
  -- Campos normalizados (gerados) para matching rápido
  logradouro_normalizado text GENERATED ALWAYS AS (public.normalize_address_text(logradouro)) STORED,
  bairro_normalizado text GENERATED ALWAYS AS (public.normalize_address_text(bairro)) STORED,
  numero_limpo text GENERATED ALWAYS AS (regexp_replace(coalesce(numero, ''), '[^0-9]', '', 'g')) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índices para performance de matching
CREATE INDEX idx_itbi_logradouro_trgm ON public.itbi_transactions USING gin (logradouro_normalizado gin_trgm_ops);
CREATE INDEX idx_itbi_bairro_trgm ON public.itbi_transactions USING gin (bairro_normalizado gin_trgm_ops);
CREATE INDEX idx_itbi_numero ON public.itbi_transactions (numero_limpo);
CREATE INDEX idx_itbi_data ON public.itbi_transactions (data_transacao DESC);
CREATE INDEX idx_itbi_sql_iptu ON public.itbi_transactions (sql_iptu) WHERE sql_iptu IS NOT NULL;
CREATE INDEX idx_itbi_ano_mes ON public.itbi_transactions (ano_referencia, mes_referencia);

-- Tabela de log de imports
CREATE TABLE public.itbi_import_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ano_referencia integer NOT NULL,
  mes_referencia integer,
  source_url text,
  rows_imported integer NOT NULL DEFAULT 0,
  rows_skipped integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  imported_by uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- RLS: itbi_transactions é leitura pública para usuários autenticados (dados oficiais)
ALTER TABLE public.itbi_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itbi_import_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read ITBI transactions"
  ON public.itbi_transactions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role full access ITBI transactions"
  ON public.itbi_transactions FOR ALL
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Admins can manage ITBI transactions"
  ON public.itbi_transactions FOR ALL
  TO authenticated
  USING (has_role('admin'::app_role))
  WITH CHECK (has_role('admin'::app_role));

-- Logs: apenas admins veem
CREATE POLICY "Admins can view ITBI import logs"
  ON public.itbi_import_log FOR SELECT
  TO authenticated
  USING (has_role('admin'::app_role));

CREATE POLICY "Admins can manage ITBI import logs"
  ON public.itbi_import_log FOR ALL
  TO authenticated
  USING (has_role('admin'::app_role))
  WITH CHECK (has_role('admin'::app_role));

CREATE POLICY "Service role full access ITBI logs"
  ON public.itbi_import_log FOR ALL
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Função RPC: pré-filtro de candidatos por similaridade trigram
-- Retorna até 200 candidatos ordenados por similaridade do logradouro
CREATE OR REPLACE FUNCTION public.match_itbi_candidates(
  p_logradouro text,
  p_numero text DEFAULT NULL,
  p_bairro text DEFAULT NULL,
  p_limit integer DEFAULT 200
)
RETURNS TABLE (
  id uuid,
  sql_iptu text,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  cep text,
  data_transacao date,
  valor_transacao numeric,
  valor_venal numeric,
  area_construida numeric,
  similarity_logradouro real,
  similarity_bairro real
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  WITH norm AS (
    SELECT
      public.normalize_address_text(p_logradouro) AS log_norm,
      public.normalize_address_text(p_bairro) AS bairro_norm,
      regexp_replace(coalesce(p_numero, ''), '[^0-9]', '', 'g') AS num_clean
  )
  SELECT
    t.id, t.sql_iptu, t.logradouro, t.numero, t.complemento, t.bairro, t.cep,
    t.data_transacao, t.valor_transacao, t.valor_venal, t.area_construida,
    similarity(t.logradouro_normalizado, (SELECT log_norm FROM norm)) AS similarity_logradouro,
    CASE WHEN (SELECT bairro_norm FROM norm) <> '' 
      THEN similarity(t.bairro_normalizado, (SELECT bairro_norm FROM norm)) 
      ELSE 0 END AS similarity_bairro
  FROM public.itbi_transactions t
  WHERE t.logradouro_normalizado % (SELECT log_norm FROM norm)
    AND (
      (SELECT num_clean FROM norm) = ''
      OR t.numero_limpo = (SELECT num_clean FROM norm)
      OR abs(coalesce(nullif(t.numero_limpo, '')::int, 0) - coalesce(nullif((SELECT num_clean FROM norm), '')::int, 0)) <= 50
    )
  ORDER BY similarity_logradouro DESC, t.data_transacao DESC
  LIMIT p_limit;
$$;