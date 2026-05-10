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

export const APP_VERSION = "v12";

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
    version: "v12",
    date: "10/mai/2026",
    notes:
      "Fix definitivo no chat-ia: o problema do v11 não era CORS no código " +
      "da function — era o `verify_jwt = true` default do gateway Supabase. " +
      "Sem `[functions.chat-ia] verify_jwt = false` no config.toml, a gateway " +
      "rejeitava o preflight OPTIONS (que vem sem Authorization) com 401 " +
      "antes do nosso código rodar. Browser via 'It does not have HTTP ok " +
      "status' e bloqueava por CORS. Adicionado chat-global, chat-property " +
      "e chat-ia ao config.toml com verify_jwt=false (chat-global/property " +
      "tinham essa config só no painel do Lovable, sem commit — agora " +
      "fica versionada junto com o código).",
  },
  {
    version: "v11",
    date: "10/mai/2026",
    notes:
      "Hotfix CORS na edge function chat-ia — botão 'Testar' falhava com " +
      "'Failed to fetch' porque a lista de Access-Control-Allow-Headers " +
      "não incluía os headers `x-supabase-client-platform`, `x-supabase-" +
      "client-runtime` (e versões) que o cliente JS @supabase/supabase-js " +
      "manda automaticamente. Browser bloqueava no preflight OPTIONS antes " +
      "do request chegar no backend. Replicamos a lista completa de chat-" +
      "global (que sempre funcionou) + Access-Control-Allow-Methods.",
  },
  {
    version: "v10",
    date: "10/mai/2026",
    notes:
      "IA refator step 2/3 — frontend integrado com a nova edge function " +
      "`chat-ia` (GPT-4o + tool calling, deployada no v? do PR backend). " +
      "GlobalAIChatDialog e AIChatDialog deixam de montar context manualmente " +
      "no frontend; a function busca via tools (get_properties, get_balancete, " +
      "get_itbi_comparables, get_ai_estimate, etc). Mudanças visuais: ícone " +
      "Sparkles → Bot, label 'Assistente IA' → 'Consultor IA', botão 'Testar' " +
      "no header dos dialogs (health check + toast com latência). Versão do " +
      "app migrou do rodapé da home pro rodapé da sidebar (visível em todas " +
      "as páginas). Sem streaming na v1 — resposta de uma vez com loading " +
      "'Pensando...'.",
  },
  {
    version: "v9",
    date: "10/mai/2026",
    notes:
      "Safe area do iOS — top bar mobile (sticky em <AppLayout>) e topo + " +
      "rodapé do <Sidebar /> agora usam env(safe-area-inset-*). Antes, em " +
      "PWA instalado no iPhone, a Dynamic Island/notch sobrepunha o botão " +
      "hambúrguer e o logo, e o home indicator cobria o botão 'Adicionar " +
      "imóvel'. Adicionados utilitários `pt-safe-top` / `pb-safe-bottom` " +
      "no Tailwind config pra reuso futuro.",
  },
  {
    version: "v8",
    date: "10/mai/2026",
    notes:
      "Fix de formatação no card Financeiro/Mês — `fmtBRLCompact` agora " +
      "trata negativos corretamente. Antes: receita renderizava 'R$ 81 mil' " +
      "mas despesa caía no fallback e virava 'R$-50166' (sem sufixo, sem " +
      "espaço, quebra visual). Agora bucketa pelo absoluto e prefixa o " +
      "sinal: '-R$ 50 mil'. Afeta qualquer lugar que use fmtBRLCompact " +
      "com valor negativo.",
  },
  {
    version: "v7",
    date: "10/mai/2026",
    notes:
      "Home redesign step 2/2 — substituiu os 5 stat-cards genéricos + " +
      "duas seções accordion (Visão de Metragem, Custos e Receitas) por " +
      "<CarteiraStats /> com 4 big-numbers segmentados: Carteira (total " +
      "+ valor mercado), Por Tipo (apartamento/casa/comercial), Status " +
      "(alugado/disponível/vendido), Financeiro do Mês (receita/líquido/" +
      "yield bruto, vindo do Balancete). Filtros compactos: busca " +
      "prominent + botão Filtros expansível com chips dos ativos.",
  },
  {
    version: "v6",
    date: "10/mai/2026",
    notes:
      "Nav reestruturada — antigo <Header /> horizontal substituído " +
      "por <Sidebar /> vertical fixa à esquerda no desktop (drawer no " +
      "mobile). Itens nomeados (Carteira, Balancete, Analytics, " +
      "Pesquisa de preço, IA, + Imóvel) com hierarquia visual e menu " +
      "de conta no rodapé. Step 1 de 2 do redesign — próximo PR refaz " +
      "os big numbers e filtros da home.",
  },
  {
    version: "v5",
    date: "10/mai/2026",
    notes:
      "Página /itbi-search agora reusa <AnalisePreco /> integralmente — " +
      "mesma UX do detalhamento (ITBI + ZAP + IA, charts, cards, filtros) " +
      "para um imóvel não-cadastrado. Form captura tipo + endereço + " +
      "quartos + metragem; submit constrói Property sintética e renderiza. " +
      "Sem persistência (id vazio = adapters pulam o write).",
  },
  {
    version: "v4",
    date: "10/mai/2026",
    notes:
      "Gráficos com eixos auto-fit + padding (chega de pontos esmagados " +
      "no canto). Estimativa IA virou faixa de referência sobreposta aos " +
      "charts de ITBI e Anúncios em vez de gráfico próprio (range bar " +
      "removido). Layout passa de 3 colunas pra 2.",
  },
  {
    version: "v3",
    date: "10/mai/2026",
    notes:
      "Filtro local de tipo + área (range progressivo) movido pra " +
      "FRONTEND em `useDadosAnuncios`. Decisão tática depois de 4 " +
      "tentativas falhas de redeploy de edge function via Lovable. O " +
      "frontend deploya confiavelmente, então a inteligência fica aqui. " +
      "Não vê mais 333m² na busca pra um imóvel de 83m², mesmo se a " +
      "edge function rodar uma versão antiga.",
  },
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
