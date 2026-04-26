-- Tabela de balancete mensal por imóvel (custos e receitas)
CREATE TABLE public.property_balancete (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  external_id TEXT, -- ID original da planilha (ex: 2025-04-001)
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  user_id UUID, -- dono (cópia do properties.user_id quando vinculado)
  ano INTEGER NOT NULL,
  mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  cidade TEXT,
  bairro TEXT,
  rua TEXT,
  numero TEXT,
  apartamento TEXT,
  complemento TEXT,
  alugado BOOLEAN DEFAULT false,
  locatario TEXT,
  cpf_locador TEXT,
  periodo_contrato TEXT,
  aluguel NUMERIC DEFAULT 0,
  condominio NUMERIC DEFAULT 0,
  reembolso_condominio NUMERIC DEFAULT 0,
  iptu NUMERIC DEFAULT 0,
  reembolso_iptu NUMERIC DEFAULT 0,
  taxa_administracao NUMERIC DEFAULT 0,
  outras_despesas NUMERIC DEFAULT 0,
  reembolso_outras_despesas NUMERIC DEFAULT 0,
  liquido NUMERIC GENERATED ALWAYS AS (
    COALESCE(aluguel,0) + COALESCE(condominio,0) + COALESCE(reembolso_condominio,0)
    + COALESCE(iptu,0) + COALESCE(reembolso_iptu,0) + COALESCE(taxa_administracao,0)
    + COALESCE(outras_despesas,0) + COALESCE(reembolso_outras_despesas,0)
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_balancete_property ON public.property_balancete(property_id);
CREATE INDEX idx_balancete_user ON public.property_balancete(user_id);
CREATE INDEX idx_balancete_ano_mes ON public.property_balancete(ano, mes);
CREATE INDEX idx_balancete_external ON public.property_balancete(external_id);

ALTER TABLE public.property_balancete ENABLE ROW LEVEL SECURITY;

-- Usuários autenticados veem todos os registros (compartilhado entre admins e usuários da empresa)
-- Mantém alinhado com properties (user pode ver os seus, admin vê todos)
CREATE POLICY "Users can view linked or own balancete or admins"
  ON public.property_balancete FOR SELECT
  TO authenticated
  USING (
    has_role('admin'::app_role)
    OR user_id = auth.uid()
    OR property_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = property_balancete.property_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins manage balancete"
  ON public.property_balancete FOR ALL
  TO authenticated
  USING (has_role('admin'::app_role))
  WITH CHECK (has_role('admin'::app_role));

CREATE POLICY "Service role full access balancete"
  ON public.property_balancete FOR ALL
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER update_balancete_updated_at
  BEFORE UPDATE ON public.property_balancete
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();