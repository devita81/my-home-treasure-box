-- Adicionar colunas de área comum, área total e número do contribuinte
ALTER TABLE public.properties
ADD COLUMN area_comum numeric DEFAULT 0,
ADD COLUMN area_total numeric DEFAULT 0,
ADD COLUMN numero_contribuinte text;