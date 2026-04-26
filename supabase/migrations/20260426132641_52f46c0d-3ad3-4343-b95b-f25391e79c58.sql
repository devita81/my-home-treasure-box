UPDATE public.property_balancete b
SET property_id = p.id, user_id = p.user_id
FROM public.properties p
WHERE b.property_id IS NULL
  AND public.normalize_address_text(b.cidade) = public.normalize_address_text(p.cidade)
  AND public.normalize_address_text(b.rua) = public.normalize_address_text(p.rua)
  AND COALESCE(public.normalize_address_text(b.numero),'') = COALESCE(public.normalize_address_text(p.numero),'')
  AND COALESCE(public.normalize_address_text(b.apartamento),'') = COALESCE(public.normalize_address_text(p.apartamento),'');