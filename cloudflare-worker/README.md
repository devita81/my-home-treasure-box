# Cloudflare Worker — chat-ia v2

Worker que serve a IA do app (Consultor IA / GlobalAIChatDialog / AIChatDialog). Substitui a antiga edge function em `supabase/functions/chat-ia/`, que ficou em "Failed to fetch" por problemas de deploy no Lovable Cloud (v10 → v13 não resolveram). Deploy aqui é via `wrangler` (CLI da Cloudflare) — direto, instantâneo, sem Lovable no caminho.

## Arquitetura

- **Runtime:** Cloudflare Workers (V8 isolates, edge global)
- **Modelo:** OpenAI GPT-4o com tool calling
- **6 tools read-only:** `get_portfolio_summary`, `get_properties`, `get_property_detail`, `get_balancete`, `get_itbi_comparables`, `get_ai_estimate`
- **Auth:** valida JWT do Supabase chamando `/auth/v1/user` (não precisa do JWT_SECRET privado — usa anon key público)
- **DB:** queries via `@supabase/supabase-js` autenticado com o JWT do usuário (RLS aplica)
- **Custo:** grátis até 100k requests/dia (free plan) — uso pessoal cabe folgado

## Setup inicial (uma vez)

```bash
cd cloudflare-worker
npm install
npx wrangler login   # abre browser, autoriza CF account
```

## Configurar secrets (uma vez)

```bash
npx wrangler secret put OPENAI_API_KEY      # cola sk-...
npx wrangler secret put SUPABASE_URL         # cola https://<project>.supabase.co
npx wrangler secret put SUPABASE_ANON_KEY    # cola o anon/publishable key
```

## Deploy

```bash
npx wrangler deploy
```

Output: URL pública tipo `https://my-home-treasure-box-ai.<seu-id>.workers.dev`. Essa URL vai no `.env` do frontend como `VITE_CF_WORKER_URL` (ou hardcoded em `src/lib/ai-chat.ts`).

## Dev local (opcional)

```bash
npx wrangler dev   # roda local em http://localhost:8787
```

## Logs ao vivo

```bash
npx wrangler tail
```

## Limites do free plan

- 100.000 requests/dia
- 10ms CPU time por request (vai dar apertado se tool calling cascateia muito — observar)
- Sem cold starts (Workers são isolates persistentes)

Se passar do limite, o plano Workers Paid é US$ 5/mês (10M requests + 50ms CPU).
