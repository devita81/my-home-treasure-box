-- Create properties table with all fields including complemento
CREATE TABLE public.properties (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  estado TEXT NOT NULL DEFAULT 'SP',
  cidade TEXT NOT NULL DEFAULT 'São Paulo',
  bairro TEXT NOT NULL DEFAULT '',
  rua TEXT NOT NULL,
  numero TEXT,
  apartamento TEXT,
  complemento TEXT,
  declared_value NUMERIC NOT NULL DEFAULT 0,
  numero_matricula TEXT,
  market_value NUMERIC DEFAULT 0,
  iptu_value NUMERIC DEFAULT 0,
  photos TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  iptu_pago BOOLEAN DEFAULT false,
  proprietario_papel TEXT,
  proprietario_matricula TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  validado BOOLEAN DEFAULT false,
  vendido BOOLEAN DEFAULT false,
  alugado BOOLEAN DEFAULT false,
  inquilino TEXT,
  valor_aluguel NUMERIC,
  valor_condominio NUMERIC
);

-- Enable Row Level Security
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access (since no auth is implemented yet)
CREATE POLICY "Allow public read access"
ON public.properties
FOR SELECT
USING (true);

-- Create policy for public insert (temporary until auth is added)
CREATE POLICY "Allow public insert"
ON public.properties
FOR INSERT
WITH CHECK (true);

-- Create policy for public update (temporary until auth is added)
CREATE POLICY "Allow public update"
ON public.properties
FOR UPDATE
USING (true);

-- Create policy for public delete (temporary until auth is added)
CREATE POLICY "Allow public delete"
ON public.properties
FOR DELETE
USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_properties_updated_at
BEFORE UPDATE ON public.properties
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();