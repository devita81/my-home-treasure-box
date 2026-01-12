-- Adicionar campo de observação na tabela properties
ALTER TABLE public.properties 
ADD COLUMN observacao text DEFAULT NULL;