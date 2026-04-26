import { supabase } from '@/integrations/supabase/client';

export type StreamMessage = { role: 'user' | 'assistant'; content: string };

interface StreamChatOptions {
  endpoint: 'chat-global' | 'chat-property';
  body: Record<string, unknown>;
  onDelta: (chunk: string) => void;
  signal?: AbortSignal;
}

const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [0, 2000, 5000];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Streams an SSE chat completion through a Lovable Cloud edge function
 * with automatic retry/backoff on transient failures (429 rate-limit and
 * network "Load failed" errors). Throws with a friendly Portuguese message
 * on terminal errors (402 credits, 401 auth, etc.).
 */
export async function streamChat({ endpoint, body, onDelta, signal }: StreamChatOptions): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error('Não autenticado');

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${endpoint}`;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (BACKOFF_MS[attempt] > 0) await sleep(BACKOFF_MS[attempt]);
    if (signal?.aborted) throw new Error('Cancelado');

    try {
      const resp = await fetch(url, {
        method: 'POST',
        signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify(body),
      });

      // Terminal — do not retry
      if (resp.status === 402) {
        throw new Error('Créditos da IA esgotados. Adicione créditos em Configurações > Workspace > Uso.');
      }
      if (resp.status === 401 || resp.status === 403) {
        throw new Error('Sessão expirada. Faça login novamente.');
      }

      // Retryable
      if (resp.status === 429 || resp.status >= 500) {
        const errData = await resp.json().catch(() => ({}));
        lastError = new Error(
          errData.error ||
            (resp.status === 429
              ? 'Limite de requisições excedido. Tentando novamente...'
              : 'Servidor da IA indisponível. Tentando novamente...')
        );
        continue;
      }

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || 'Erro ao consultar IA');
      }

      if (!resp.body) throw new Error('Sem corpo de resposta');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let received = false;
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') {
            streamDone = true;
            break;
          }
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              received = true;
              onDelta(delta);
            }
          } catch {
            // partial json — re-buffer
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }

      if (!received) {
        // Empty stream — treat as transient and retry
        lastError = new Error('Resposta vazia da IA. Tentando novamente...');
        continue;
      }

      return;
    } catch (err) {
      if (signal?.aborted) throw new Error('Cancelado');
      const msg = err instanceof Error ? err.message : String(err);
      // Non-retryable errors bubble up immediately
      if (
        msg.includes('Créditos') ||
        msg.includes('Sessão expirada') ||
        msg.includes('Não autenticado')
      ) {
        throw err;
      }
      lastError = err instanceof Error ? err : new Error(msg);
    }
  }

  throw lastError || new Error('Falha ao consultar IA após várias tentativas');
}