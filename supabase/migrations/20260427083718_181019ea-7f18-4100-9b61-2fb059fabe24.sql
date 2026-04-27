-- Normaliza um pedaço de texto de endereço (uppercase, sem acentos, sem pontuação, espaços colapsados)
CREATE OR REPLACE FUNCTION public.normalize_addr_part(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'pg_catalog'
AS $$
  SELECT NULLIF(
    regexp_replace(
      regexp_replace(
        upper(public.unaccent('public.unaccent', coalesce(input, ''))),
        '[^A-Z0-9]+', ' ', 'g'
      ),
      '\s+', ' ', 'g'
    ),
    ' '
  );
$$;

-- Constrói a chave forte do imóvel a partir de cidade + rua + numero + apartamento + complemento
CREATE OR REPLACE FUNCTION public.build_property_key(
  p_cidade text,
  p_rua text,
  p_numero text,
  p_apartamento text,
  p_complemento text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'pg_catalog'
AS $$
  SELECT
    coalesce(trim(public.normalize_addr_part(p_cidade)), '') || '|' ||
    coalesce(trim(public.normalize_addr_part(p_rua)), '') || '|' ||
    coalesce(trim(public.normalize_addr_part(p_numero)), '') || '|' ||
    coalesce(trim(public.normalize_addr_part(p_apartamento)), '') || '|' ||
    coalesce(trim(public.normalize_addr_part(p_complemento)), '')
$$;