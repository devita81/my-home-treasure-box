-- Adicionar colunas de características do imóvel
ALTER TABLE public.properties
ADD COLUMN quartos integer DEFAULT 0,
ADD COLUMN banheiros integer DEFAULT 0,
ADD COLUMN suites integer DEFAULT 0,
ADD COLUMN garagens integer DEFAULT 0,
ADD COLUMN metragem numeric DEFAULT 0;