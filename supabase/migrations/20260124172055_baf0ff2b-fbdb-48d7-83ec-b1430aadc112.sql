-- Add second owner on registration and percentage columns
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS proprietario_matricula_ii text,
ADD COLUMN IF NOT EXISTS percentual_proprietario_matricula numeric DEFAULT 100,
ADD COLUMN IF NOT EXISTS percentual_proprietario_matricula_ii numeric DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN public.properties.proprietario_matricula_ii IS 'Second owner name on property registration';
COMMENT ON COLUMN public.properties.percentual_proprietario_matricula IS 'Ownership percentage for first owner on registration (0-100)';
COMMENT ON COLUMN public.properties.percentual_proprietario_matricula_ii IS 'Ownership percentage for second owner on registration (0-100)';