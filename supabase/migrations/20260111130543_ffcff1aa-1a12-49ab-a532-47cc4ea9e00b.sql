-- Add tipo_imovel field for property type
ALTER TABLE public.properties 
ADD COLUMN tipo_imovel text DEFAULT 'apartamento';

-- Add latitude and longitude fields for manual location adjustment
ALTER TABLE public.properties 
ADD COLUMN latitude numeric NULL;

ALTER TABLE public.properties 
ADD COLUMN longitude numeric NULL;