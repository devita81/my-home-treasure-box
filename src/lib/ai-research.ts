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

// ─── cache em localStorage ───────────────────────────────────────────

const CACHE_PREFIX = "research:";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

interface CachedResearch extends ResearchResponse {
  cachedAt: number;
}

/**
 * Lê cache de análise por property.id. Retorna null se não há cache
 * ou se já expirou (>7 dias). Pra Pesquisa avulsa (sem id), passar
 * null e o caller pula o cache.
 */
export function getCachedResearch(propertyId: string | null): ResearchResponse | null {
  if (!propertyId) return null;
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + propertyId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedResearch;
    if (Date.now() - parsed.cachedAt > CACHE_TTL_MS) {
      localStorage.removeItem(CACHE_PREFIX + propertyId);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Grava no cache. No-op se propertyId é null (Pesquisa avulsa). */
export function setCachedResearch(
  propertyId: string | null,
  result: ResearchResponse,
): void {
  if (!propertyId) return;
  try {
    const payload: CachedResearch = { ...result, cachedAt: Date.now() };
    localStorage.setItem(CACHE_PREFIX + propertyId, JSON.stringify(payload));
  } catch {
    // localStorage cheio ou private mode — falha silenciosa
  }
}

/** Invalida cache de uma análise específica (botão "Refazer análise"). */
export function clearCachedResearch(propertyId: string | null): void {
  if (!propertyId) return;
  try {
    localStorage.removeItem(CACHE_PREFIX + propertyId);
  } catch {
    // silencioso
  }
}
