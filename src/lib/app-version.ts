// Versão visível do app — incrementada manualmente a cada deploy
// significativo. Renderizada no rodapé do `Index` para confirmar
// rapidamente se o deploy do Lovable pegou (sem precisar abrir
// DevTools ou logs do Supabase).
//
// Convenção: número sequencial simples. Sempre que mexer em código
// que vai pra produção e precisamos confirmar deploy, bumpar `APP_VERSION`
// e adicionar uma linha em `APP_VERSION_HISTORY` resumindo o que mudou.
//
// Como conferir o deploy:
//   1. Após merge + redeploy do Lovable, abrir a home do app.
//   2. No rodapé/topo aparece "v3 · 10/mai/2026".
//   3. Se bater com o último número listado abaixo, deploy ok.

export const APP_VERSION = "v2";

export const APP_VERSION_DATE = "10/mai/2026";

/**
 * Histórico das versões — a mais recente em cima. Cada entrada lista
 * o que entrou pra essa versão. Útil pra contexto rápido sem
 * precisar olhar o git log.
 */
export const APP_VERSION_HISTORY: ReadonlyArray<{
  version: string;
  date: string;
  notes: string;
}> = [
  {
    version: "v2",
    date: "10/mai/2026",
    notes:
      "Migration idempotente adicionando `cep` à `properties` (resolve " +
      "build do sandbox Lovable). Reference explícita a `google.maps` no " +
      "`InteractiveMap`. Re-bump do deployment marker da edge function " +
      "(v11→v12) — o redeploy v11 do Lovable não pegou.",
  },
  {
    version: "v1",
    date: "10/mai/2026",
    notes:
      "Marco inicial do versionamento visível. Filtros locais ZAP " +
      "(tipo + área com range progressivo), payload `_debug` na resposta " +
      "pra confirmar deploy via DevTools.",
  },
];
