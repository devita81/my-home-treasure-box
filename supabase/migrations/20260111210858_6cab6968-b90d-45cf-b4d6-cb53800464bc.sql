-- Add construction year column to properties table
ALTER TABLE public.properties 
ADD COLUMN ano_construcao integer NULL;

-- Add a comment for documentation
COMMENT ON COLUMN public.properties.ano_construcao IS 'Ano de construção do imóvel';