-- Garante que a coluna `cep` existe na tabela `properties`. O campo já
-- está em `src/integrations/supabase/types.ts` há algum tempo (Row,
-- Insert, Update da `properties`) e em `src/types/property.ts`, mas
-- nunca houve migration adicionando explicitamente — provavelmente foi
-- adicionado direto via Supabase Studio em algum projeto (não em todos).
--
-- Resultado: o sandbox do Lovable, ao regenerar `types.ts` a partir do
-- schema da Cloud DELE, removia `cep` (não existia naquele banco) e o
-- build TS quebrava em `PropertyContext.tsx:98` no `update(updates)`
-- onde `Partial<Property>` ficava incompatível com o Update gerado.
--
-- `IF NOT EXISTS` torna a migration idempotente — se a coluna já
-- existir (caso do banco principal), nada acontece e nenhum erro é
-- levantado. Se não existir (caso do sandbox), é criada.

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS cep TEXT;

-- Comentário pra documentação no Studio.
COMMENT ON COLUMN public.properties.cep IS
  'CEP do imóvel (8 dígitos, sem hífen). Opcional.';
