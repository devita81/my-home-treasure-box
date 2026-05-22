// Hook compartilhado pro estado da "Análise profunda" — extraído da
// AnaliseProfunda.tsx pra que o BotaoExportarPdf possa LER o mesmo
// resultado (ou disparar a geração) sem duplicar o call ao Worker
// /research (que custa ~R$ 1 cada).
//
// Por que react-query: o cache compartilhado por queryKey garante que
// AnaliseProfunda e BotaoExportarPdf vejam exatamente o mesmo
// `result`, mesmo sendo subárvores separadas. Sem isso teríamos que
// lift state pro AnalisePreco e passar via props/context.
//
// Persistência:
//   • Pré-cadastrados (property.id !== ""): query lê de
//     properties.ai_deep_research_*; mutation grava de volta.
//   • Avulsa (sem id): query queryFn devolve null direto; mutation
//     só atualiza cache em memória. Não persiste em DB.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import {
  runResearch,
  type ResearchCitation,
  type ResearchResponse,
} from "@/lib/ai-research";
import type { Property } from "@/types/property";

export interface PersistedResearch {
  markdown: string;
  citations: ResearchCitation[];
  updatedAt: string | null;
}

interface UseAnaliseProfundaReturn {
  /** Resultado consolidado — null se ainda não foi gerada. */
  result: PersistedResearch | null;
  /** True enquanto o useQuery carrega do DB (só pré-cad). */
  loadingFromDb: boolean;
  /** True enquanto a mutação runResearch está executando. */
  loading: boolean;
  /** Erro da última execução (null se ok ou nunca rodou). */
  error: string | null;
  /** Latência da última run (ms) — null em runs persistidas/anteriores. */
  lastElapsedMs: number | null;
  /** Aviso quando o resultado veio mas o persist no DB falhou. */
  persistError: string | null;
  /** Dispara nova análise (ou primeira). Resolve quando termina. */
  run: () => Promise<PersistedResearch>;
  /** Redispara, descartando resultado anterior. */
  refazer: () => Promise<PersistedResearch>;
}

/**
 * Chave de cache react-query. Pré-cadastrados usam o UUID; avulsa
 * (sem id) usa um fingerprint dos campos relevantes — assim duas
 * pesquisas avulsas do mesmo endereço compartilham resultado dentro
 * da mesma sessão, mas mudar de imóvel não vaza.
 */
function buildQueryKey(property: Property): readonly unknown[] {
  if (property.id) return ["analise-profunda", "id", property.id];
  return [
    "analise-profunda",
    "avulsa",
    property.rua ?? "",
    property.numero ?? "",
    property.bairro ?? "",
    property.cidade ?? "",
    property.tipo_imovel ?? "",
    property.metragem ?? "",
  ];
}

export function useAnaliseProfunda(property: Property): UseAnaliseProfundaReturn {
  const isPersisted = !!property.id;
  const queryClient = useQueryClient();
  const queryKey = buildQueryKey(property);

  // ─── Query: carrega do DB se pré-cadastrado ───────────────────────
  const query = useQuery<PersistedResearch | null>({
    queryKey,
    queryFn: async () => {
      if (!isPersisted) return null;
      // Cast `supabase as any` na origem — generated types ainda não
      // têm as colunas ai_deep_research_*. Quando o Lovable regerar
      // os types depois da migration, dá pra remover.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- generated types ainda não têm as colunas ai_deep_research_*
      const { data, error: dbErr } = await (supabase as any)
        .from("properties")
        .select(
          "ai_deep_research_md, ai_deep_research_citations, ai_deep_research_updated_at",
        )
        .eq("id", property.id)
        .maybeSingle();
      if (dbErr) {
        logger.error("[useAnaliseProfunda] erro lendo DB:", dbErr);
        return null;
      }
      const row = data as {
        ai_deep_research_md?: string | null;
        ai_deep_research_citations?: ResearchCitation[] | null;
        ai_deep_research_updated_at?: string | null;
      } | null;
      if (!row?.ai_deep_research_md) return null;
      return {
        markdown: row.ai_deep_research_md,
        citations: row.ai_deep_research_citations ?? [],
        updatedAt: row.ai_deep_research_updated_at ?? null,
      };
    },
    // Cache fica vivo durante a sessão; nova montagem reusa.
    staleTime: 60 * 60 * 1000, // 1h
    // Não refetcha em foco — o user controla via "Refazer análise".
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  // ─── Mutation: dispara runResearch + persiste (se pré-cad) ────────
  const mutation = useMutation<
    { result: PersistedResearch; elapsedMs: number; persistError: string | null },
    Error,
    void
  >({
    mutationFn: async () => {
      const res = await runResearch({
        property: {
          rua: property.rua,
          numero: property.numero,
          bairro: property.bairro,
          cidade: property.cidade,
          estado: property.estado,
          cep: property.cep,
          tipo_imovel: property.tipo_imovel,
          metragem: property.metragem,
          area_total: property.area_total,
          quartos: property.quartos,
          suites: property.suites,
          banheiros: property.banheiros,
          garagens: property.garagens,
          ano_construcao: property.ano_construcao,
        },
      });
      const persistedResearch: PersistedResearch = {
        markdown: res.markdown,
        citations: res.citations,
        updatedAt: new Date().toISOString(),
      };
      const persistError = await persistToDb(property.id, res);
      return {
        result: persistedResearch,
        elapsedMs: res.elapsedMs,
        persistError,
      };
    },
    onSuccess: ({ result }) => {
      // Atualiza o cache da query — AnaliseProfunda re-renderiza com
      // o novo resultado automaticamente.
      queryClient.setQueryData(queryKey, result);
    },
  });

  const run = async (): Promise<PersistedResearch> => {
    const { result } = await mutation.mutateAsync();
    return result;
  };

  const refazer = async (): Promise<PersistedResearch> => {
    // Limpa o cache antes pra UI de "Refazer" começar do zero (o
    // componente AnaliseProfunda usa o cache pra decidir entre o
    // estado vazio e mostrar resultado).
    queryClient.setQueryData(queryKey, null);
    return run();
  };

  return {
    result: query.data ?? null,
    loadingFromDb: query.isLoading,
    loading: mutation.isPending,
    error: mutation.error ? mutation.error.message : null,
    lastElapsedMs: mutation.data?.elapsedMs ?? null,
    persistError: mutation.data?.persistError ?? null,
    run,
    refazer,
  };
}

/**
 * Persiste o resultado nas colunas ai_deep_research_* da `properties`.
 * Retorna mensagem amigável se falhar (column missing, RLS, etc), ou
 * null se ok. Caller usa essa string pra mostrar warning UI.
 */
async function persistToDb(
  propertyId: string,
  res: ResearchResponse,
): Promise<string | null> {
  if (!propertyId) return null;
  const updatePayload = {
    ai_deep_research_md: res.markdown,
    ai_deep_research_citations: res.citations,
    ai_deep_research_updated_at: new Date().toISOString(),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- generated types ainda não têm as colunas ai_deep_research_*
  const { error: dbErr } = await (supabase as any)
    .from("properties")
    .update(updatePayload)
    .eq("id", propertyId);
  if (!dbErr) return null;

  // Log estruturado pra diagnóstico — antes era o objeto cru e o
  // PostgrestError ficava ilegível. Captura code/message/details/hint.
  logger.error("[useAnaliseProfunda] erro gravando DB", {
    code: dbErr.code,
    message: dbErr.message,
    details: dbErr.details,
    hint: dbErr.hint,
  });
  if (
    dbErr.code === "42703" ||
    /column.*does not exist/i.test(dbErr.message ?? "")
  ) {
    return (
      "Banco ainda não tem as colunas pra salvar (migration pendente). " +
      "A análise aparece nesta sessão mas vai sumir quando recarregar."
    );
  }
  return (
    "Não foi possível salvar a análise no banco. A análise aparece " +
    "nesta sessão mas vai sumir quando recarregar."
  );
}
