// Cliente do endpoint /research do Cloudflare Worker. Análise
// profunda via Claude Sonnet 4.5 + web_search — diferente do `chatIa`
// (em ai-chat.ts) que faz tool calling no DB. Aqui o modelo pesquisa
// na web (ZAP, VivaReal, QuintoAndar, etc) e produz relatório
// markdown com citações.
//
// Tempo típico: 30-90s. Custo típico: ~R$ 0,50-1,50 por análise.
// Por isso o frontend usa cache (localStorage por property.id) e
// só dispara quando o usuário clica "Gerar análise profunda".

import { supabase } from "@/integrations/supabase/client";
import type { Property } from "@/types/property";

// Mesma URL do chat. O Worker roteia internamente por pathname.
const CF_WORKER_URL = "https://my-home-treasure-box-ai.renatodevita.workers.dev";

export interface ResearchCitation {
  url: string;
  title: string;
}

export interface ResearchResponse {
  markdown: string;
  citations: ResearchCitation[];
  elapsedMs: number;
  usage?: { input_tokens: number; output_tokens: number } | null;
}

/**
 * Subset dos campos de Property que o Worker /research consome.
 * Manter explícito (em vez de mandar Property inteira) reduz superfície
 * e evita vazar metadados desnecessários (fotos, user_id, etc).
 */
export type ResearchPropertyPayload = Pick<
  Property,
  | "rua"
  | "numero"
  | "bairro"
  | "cidade"
  | "estado"
  | "cep"
  | "tipo_imovel"
  | "metragem"
  | "area_total"
  | "quartos"
  | "suites"
  | "banheiros"
  | "garagens"
  | "ano_construcao"
>;

interface RunResearchOptions {
  property: ResearchPropertyPayload;
  signal?: AbortSignal;
}

/**
 * Chama o endpoint /research do CF Worker e devolve o relatório
 * pronto. Erros são propagados como Error com mensagem em PT.
 *
 * Frontend nunca aborta automaticamente — o usuário pode esperar
 * 30-90s sem problema. AbortSignal só serve se quisermos um botão
 * "Cancelar" no futuro.
 */
export async function runResearch({
  property,
  signal,
}: RunResearchOptions): Promise<ResearchResponse> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error("Não autenticado");

  const resp = await fetch(`${CF_WORKER_URL}/research`, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ property }),
  });

  if (resp.status === 401 || resp.status === 403) {
    throw new Error("Sessão expirada. Faça login novamente.");
  }
  if (!resp.ok) {
    const errData = (await resp.json().catch(() => ({}))) as { error?: string };
    throw new Error(errData.error || `Erro ${resp.status}`);
  }

  return (await resp.json()) as ResearchResponse;
}

// Cache em localStorage foi removido no v27 — persistência agora vive
// nas colunas ai_deep_research_* da tabela `properties` (mesmo padrão
// do useDadosEstimativaIa). Avulsa (sem id) não cacheia, vive só em
// memória do componente AnaliseProfunda.tsx.
