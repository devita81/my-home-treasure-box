WITH latest AS (
  SELECT DISTINCT ON (property_id)
    property_id,
    ROUND(ABS(COALESCE(iptu, 0))::numeric, 2) AS iptu_mensal
  FROM public.property_balancete
  WHERE property_id IS NOT NULL
    AND iptu IS NOT NULL
    AND iptu <> 0
  ORDER BY property_id, ano DESC, mes DESC
)
UPDATE public.properties p
SET iptu_value = latest.iptu_mensal
FROM latest
WHERE p.id = latest.property_id
  AND COALESCE(p.iptu_value, 0) <> latest.iptu_mensal;