
ALTER TABLE public.itbi_transactions
  ADD COLUMN IF NOT EXISTS referencia text,
  ADD COLUMN IF NOT EXISTS proporcao_transmitida numeric,
  ADD COLUMN IF NOT EXISTS valor_venal_proporcional numeric,
  ADD COLUMN IF NOT EXISTS base_calculo numeric,
  ADD COLUMN IF NOT EXISTS tipo_financiamento text,
  ADD COLUMN IF NOT EXISTS valor_financiado numeric,
  ADD COLUMN IF NOT EXISTS cartorio_registro text,
  ADD COLUMN IF NOT EXISTS matricula_imovel text,
  ADD COLUMN IF NOT EXISTS situacao_sql text,
  ADD COLUMN IF NOT EXISTS testada numeric,
  ADD COLUMN IF NOT EXISTS fracao_ideal numeric,
  ADD COLUMN IF NOT EXISTS uso_iptu text,
  ADD COLUMN IF NOT EXISTS descricao_uso_iptu text,
  ADD COLUMN IF NOT EXISTS padrao_iptu text,
  ADD COLUMN IF NOT EXISTS descricao_padrao_iptu text,
  ADD COLUMN IF NOT EXISTS acc_iptu text,
  ADD COLUMN IF NOT EXISTS linha_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS itbi_transactions_linha_hash_uniq
  ON public.itbi_transactions(linha_hash)
  WHERE linha_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS itbi_transactions_descricao_uso_idx
  ON public.itbi_transactions(descricao_uso_iptu);

CREATE INDEX IF NOT EXISTS itbi_transactions_situacao_sql_idx
  ON public.itbi_transactions(situacao_sql);
