import { supabase } from '@/integrations/supabase/client';

// Cliente do edge function `chat-ia` (GPT-4o + tool calling). Substitui
// o antigo `streamChat` em `ai-stream.ts` que falava com `chat-global` /
// `chat-property` via SSE. A function nova faz tool calling no backend
// e responde de uma vez (sem streaming) — UX é "Pensando..." → resposta
// completa, ~3-8s típicos.
//
// Mantemos `ai-stream.ts` por enquanto pra não quebrar fallback —
// limpeza fica pro PR 3 quando deletarmos chat-global e chat-property.

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export interface ChatIaResponse {
  content: string;
  iterationsUsed: number;
  /** Tempo total request → response em ms. */
  elapsedMs: number;
}

interface ChatIaOptions {
  messages: ChatMessage[];
  /** Quando vem, a function injeta um system message focando esse imóvel. */
  propertyId?: string;
  signal?: AbortSignal;
}

/**
 * Chama a edge function `chat-ia` e devolve a resposta final do
 * modelo. Erros são mapeados pra mensagens em português que fazem
 * sentido pro usuário (sessão expirada, função não deployada, etc.).
 */
export async function chatIa({
  messages,
  propertyId,
  signal,
}: ChatIaOptions): Promise<ChatIaResponse> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error('Não autenticado');

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-ia`;
  const startedAt = performance.now();

  const resp = await fetch(url, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ messages, propertyId }),
  });

  if (resp.status === 401 || resp.status === 403) {
    throw new Error('Sessão expirada. Faça login novamente.');
  }
  if (resp.status === 404) {
    throw new Error("Função 'chat-ia' não foi deployada — Lovable não sincronizou.");
  }
  if (!resp.ok) {
    const errData = (await resp.json().catch(() => ({}))) as { error?: string };
    // 429 (rate limit), 500 (OpenAI key inválida ou ausente) etc — passa
    // a mensagem do backend pra cima sem reescrever, porque o backend
    // já vem com mensagens user-friendly em português (ver chat-ia/index.ts).
    throw new Error(errData.error || `Erro ${resp.status}`);
  }

  const data = (await resp.json()) as { content?: string; iterations_used?: number };
  const elapsedMs = Math.round(performance.now() - startedAt);
  return {
    content: data.content ?? '',
    iterationsUsed: data.iterations_used ?? 1,
    elapsedMs,
  };
}

// ─── health check ────────────────────────────────────────────────────

export interface PingResult {
  ok: boolean;
  latencyMs: number;
  /** Mensagem pronta pra mostrar ao usuário (toast). */
  message: string;
  /** Severidade pra escolher cor do toast. */
  severity: 'success' | 'error' | 'warning';
}

/**
 * Health check do `chat-ia`. Manda uma pergunta trivial ("responda com
 * ok") e classifica o resultado em success/error/warning com mensagem
 * pronta pra toast. Custo: ~$0.0001 por chamada (1-3 tokens cada lado).
 *
 * NÃO entra no histórico do dialog — é uma chamada paralela isolada
 * só pra confirmar que function tá deployada + key OpenAI configurada.
 */
export async function pingChatIa(): Promise<PingResult> {
  try {
    const result = await chatIa({
      messages: [
        { role: 'user', content: 'Responda apenas com a palavra: ok' },
      ],
    });
    return {
      ok: true,
      latencyMs: result.elapsedMs,
      severity: 'success',
      message: `Conectado — modelo respondeu em ${(result.elapsedMs / 1000).toFixed(1)}s`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    // Classifica severidade pelo tipo de erro pra escolher toast certo:
    // rate-limit é warning (transitório), resto é error.
    const severity: PingResult['severity'] = /rate.limit|excedido|aguarde/i.test(msg)
      ? 'warning'
      : 'error';
    return {
      ok: false,
      latencyMs: 0,
      severity,
      message: msg,
    };
  }
}
