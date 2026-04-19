CREATE OR REPLACE FUNCTION public.match_itbi_candidates(
  p_logradouro text,
  p_numero text DEFAULT NULL::text,
  p_bairro text DEFAULT NULL::text,
  p_limit integer DEFAULT 200
)
RETURNS TABLE(id uuid, sql_iptu text, logradouro text, numero text, complemento text, bairro text, cep text, data_transacao date, valor_transacao numeric, valor_venal numeric, area_construida numeric, similarity_logradouro real, similarity_bairro real)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
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
  WHERE
    (SELECT num_clean FROM norm) <> ''
    AND t.numero_limpo = (SELECT num_clean FROM norm)
    AND t.logradouro_normalizado % (SELECT log_norm FROM norm)
  ORDER BY similarity_logradouro DESC, t.data_transacao DESC
  LIMIT p_limit;
$function$;