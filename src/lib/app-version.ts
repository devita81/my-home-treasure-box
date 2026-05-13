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

export const APP_VERSION = "v27";

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
    version: "v27",
    date: "11/mai/2026",
    notes:
      "Feature nova: 'Análise profunda' — relatório de avaliação " +
      "imobiliária via Claude Sonnet 4.5 + web_search. Roda dentro do " +
      "Cloudflare Worker (mesmo onde chat-ia vive), novo endpoint " +
      "POST /research. Pesquisa multi-fonte (ZAP, VivaReal, " +
      "QuintoAndar, OLX, ImovelWeb), produz relatório estruturado em " +
      "markdown com 5-10 comparáveis citados + análise da região + " +
      "cenários de venda + recomendações. Renderizado num Card " +
      "separado no topo da seção <AnalisePreco /> (acima dos charts " +
      "ITBI/Anúncios/IA). Cache em localStorage por property.id " +
      "(7 dias TTL). Tempo típico ~60s, custo ~R$ 1 por análise. " +
      "Não toca em Estimativa IA antiga (OpenAI single-shot) — as " +
      "duas coexistem; cleanup do antigo pode vir depois se você " +
      "validar que a Análise profunda substitui bem.",
  },
  {
    version: "v26",
    date: "11/mai/2026",
    notes:
      "Pesquisa pontual de preço (/itbi-search) agora geocodifica o " +
      "endereço antes de submeter — antes o Property sintético não tinha " +
      "lat/lon, e a edge function fetch-zap-listings caía em fallback de " +
      "busca textual fraca (mesmo endereço pré-cadastrado devolvia 8 " +
      "comparáveis precisos, na avulsa devolvia 0 ou listings dispersos). " +
      "Fix: SearchFields ganha latitude/longitude; autocomplete (Nominatim) " +
      "popula essas coords no onSelect; se user digitar manualmente sem " +
      "usar o dropdown, handleSubmit faz uma chamada Nominatim adicional " +
      "no submit antes de buildSyntheticProperty. Botão 'Analisar preço' " +
      "vira 'Localizando...' durante esse passo. Mexer manualmente em " +
      "rua/bairro/cidade/estado invalida lat/lon antigo automaticamente.",
  },
  {
    version: "v25",
    date: "11/mai/2026",
    notes:
      "ZAP filtro de área: ±30% strict (sem fallback widen). Histórico: " +
      "v3 ±100% → v24 ±50% → v25 ±30%. v24 ainda dava sensação de " +
      "'comparáveis fora' — busca por 163m² aceitava 81-244m² mesmo o " +
      "inventário daquela rua sendo 79-124m². Agora pra 163m² o range " +
      "vira 114-212m² — só passa quem está realmente próximo. " +
      "Se filtro deixar 0 listings, UI mostra '0 pts' e usuário " +
      "amplia explicitamente via chips FAIXA DE ÁREA. Preferimos 0-2 " +
      "comparáveis precisos a 7 inflados que confundem.",
  },
  {
    version: "v24",
    date: "11/mai/2026",
    notes:
      "3 fixes na Pesquisa pontual de preço (/itbi-search): " +
      "(1) Botão 'Editar busca' agora preserva os campos preenchidos — " +
      "antes o form era desmontado/remontado e o estado interno zerava. " +
      "Fix: state `fields` migrado pro componente pai ItbiSearch, passado " +
      "como prop pro SearchForm que virou stateless. " +
      "(2) Filtro ZAP por metragem agora capa em ±50% (antes ia até " +
      "±100% que aceitava o dobro do tamanho — usuário percebia como " +
      "'totalmente fora'). Pra 83m² agora limita em 41-124m². " +
      "(3) Marcação visual obrigatório/opcional: novo componente " +
      "FieldLabel mostra asterisco vermelho em Rua e Bairro (sinaliza " +
      "'rua OU bairro') e '(opcional)' cinza nos demais campos. Texto " +
      "de ajuda reformulado.",
  },
  {
    version: "v23",
    date: "11/mai/2026",
    notes:
      "Autocomplete de endereço via Nominatim (OpenStreetMap, grátis). " +
      "Usuário digita 3+ caracteres na 'Rua', sistema busca após 500ms " +
      "parado e mostra dropdown com até 5 sugestões. Click numa " +
      "sugestão preenche automaticamente bairro, cidade, estado, CEP " +
      "(quando disponível) e latitude/longitude. Aplicado em 2 lugares: " +
      "(1) formulário Adicionar/Editar imóvel, (2) Pesquisa pontual " +
      "de preço (/itbi-search). Componente reusável " +
      "<AddressAutocompleteInput /> em src/components/ui/. Hook " +
      "useAddressAutocomplete com debounce + abort de requests " +
      "anteriores. Limitação: Nominatim limita 1 req/s, mas o debounce " +
      "+ abort cobrem uso normal. Se a qualidade não bastar, dá pra " +
      "migrar pra Google Places mantendo a interface.",
  },
  {
    version: "v22",
    date: "11/mai/2026",
    notes:
      "Formulário de imóvel: marca rua + número como obrigatórios. " +
      "Labels ganham asterisco vermelho (acessibilidade via aria-required), " +
      "Zod schema do número muda de `.optional()` pra `.min(1)` com " +
      "mensagem 'Número é obrigatório (use S/N se não tiver número)'. " +
      "Placeholder no input do número explicita a convenção. Bonus: " +
      "card Estimativa IA em PropertyDetails agora detecta cidade/rua/" +
      "bairro/estado faltantes ANTES de chamar a edge function e mostra " +
      "mensagem amigável ('Preencha bairro no cadastro do imóvel') em " +
      "vez do erro técnico 'Edge Function returned a non-2xx status " +
      "code'. Próximo PR: autocomplete de endereço via Nominatim — " +
      "usuário digita rua, app sugere bairro/cidade/estado/lat/lon.",
  },
  {
    version: "v21",
    date: "11/mai/2026",
    notes:
      "UX foundation step 6/N — Fecha a migração de typography. 68 " +
      "substituições em 15 arquivos menores (dialogs, analise-preco/*, " +
      "ItbiAdmin, ItbiSearch, Sidebar, markdown-render, etc) via bulk " +
      "sed no scale 10/11/12/13. Mais 2 one-offs: text-[15px] no logo " +
      "'My Home Collection' da Sidebar → text-base (16px, brand fica " +
      "ligeiramente mais presente); text-[14px] no h1 do markdown do " +
      "GlobalAIChatDialog → text-sm (Tailwind padrão). Estado final: " +
      "zero text-[NNpx] em src/ (430 → 0). Próximos PRs do UX " +
      "foundation são padronizações finas: cards, cores, mobile " +
      "compact.",
  },
  {
    version: "v20",
    date: "11/mai/2026",
    notes:
      "UX foundation step 5/N — Aplica type scale em Balancete.tsx, " +
      "segunda página mais densa do app. 131 substituições (61 " +
      "text-[13px] + 59 text-[12px] + 11 text-[11px] → text-data / " +
      "text-label / text-meta) + 1 text-[14px] → text-sm (já era " +
      "exatamente o valor padrão do Tailwind, sem necessidade de token " +
      "novo). Estado: dos 430 ad-hoc originais, ~430 substituídos só " +
      "nas páginas grandes. Sobra ~30 espalhados em 10 arquivos menores " +
      "(Sidebar, dialogs, analise-preco/*) — próximo PR agrupa tudo.",
  },
  {
    version: "v19",
    date: "11/mai/2026",
    notes:
      "UX foundation step 4/N — Aplica type scale semântica em " +
      "Analytics.tsx, a página mais densa do app. 217 substituições " +
      "num único arquivo (110 text-[13px] + 95 text-[12px] + 12 " +
      "text-[11px] → text-data / text-label / text-meta). Maior PR de " +
      "substituição até agora. Visual: zero diferença em pixel sizes. " +
      "Sobra Balancete.tsx (119) + 10 arquivos menores no resto da " +
      "migração.",
  },
  {
    version: "v18",
    date: "11/mai/2026",
    notes:
      "UX foundation step 3/N — Aplica type scale semântica em " +
      "PropertyDetails e sub-sections (PropertyCadastroSection, " +
      "PropertyFinanceiroSection). ~30 substituições (15 text-[12px] + " +
      "13 text-[13px] + 1 text-[11px] + 1 text-[10px]) → text-label / " +
      "text-data / text-meta / text-nano. Página densa, terceira maior " +
      "concentração de texto do app. Visual: zero diferença em pixel " +
      "sizes, só line-heights levemente otimizados. Próximos: " +
      "Analytics (216 ocorrências!) e Balancete (119) — esses dois " +
      "sozinhos têm 78% do que sobrou (335 de 430 totais).",
  },
  {
    version: "v17",
    date: "11/mai/2026",
    notes:
      "UX foundation step 2/N — Aplica type scale semântica em " +
      "<PropertyCard /> (componente mais reusado, renderizado por imóvel " +
      "no grid da home). ~30 substituições de text-[NNpx] ad-hoc por " +
      "text-data / text-label / text-meta. Também limpa um conditional " +
      "morto na linha do endereço (`compact ? 'text-sm' : 'text-sm'`) — " +
      "ambos lados iguais, simplificado pra 'text-sm' direto. Mudança " +
      "visual: zero (mesmas pixel sizes), só semântica e line-heights " +
      "ligeiramente otimizados pelas utilities.",
  },
  {
    version: "v16",
    date: "11/mai/2026",
    notes:
      "UX foundation step 1/N — Auditoria visual revelou 495 usos de " +
      "`text-[NNpx]` ad-hoc espalhados (text-[10px] até text-[15px]). " +
      "Adicionados 4 utilities semânticos em src/index.css: `.text-data` " +
      "(13px, valores), `.text-label` (12px, labels de form/row), `.text-meta` " +
      "(11px, headers minúsculos/badges), `.text-nano` (10px, micro-markers). " +
      "Cada um inclui line-height calibrado pra legibilidade. Aplicados em " +
      "<CarteiraStats /> (4 substituições) e <PropertyFilters /> (7 " +
      "substituições). Próximos PRs: aplicar em <PropertyCard /> e " +
      "<PropertyDetails /> (densidade alta de texto), depois padronizar " +
      "padding/border de cards.",
  },
  {
    version: "v15",
    date: "11/mai/2026",
    notes:
      "Melhora qualidade da resposta do Consultor IA pra perguntas de " +
      "performance financeira. No v14 (primeiro deploy via CF Worker) o " +
      "modelo respondeu 'qual imóvel está dando mais prejuízo?' olhando " +
      "valor_aluguel=0 da tabela properties — confundiu CADASTRAL com " +
      "REALIZADO. Reforço no system prompt: (a) seção 'DOIS UNIVERSOS DE " +
      "DADOS — properties (cadastral) vs property_balancete (realizado)'; " +
      "(b) sequência obrigatória pra perguntas de performance — sempre " +
      "get_balancete primeiro; (c) interpretação correta de 'prejuízo' " +
      "(RESULTADO_REAL negativo, não valor_aluguel=0); (d) exemplos " +
      "concretos de raciocínio certo vs errado. Worker deployado direto " +
      "via wrangler — esta entrada no histórico só pra tracking.",
  },
  {
    version: "v14",
    date: "11/mai/2026",
    notes:
      "IA migra do Supabase Edge Functions (Lovable) pra Cloudflare " +
      "Workers — quebrando a sequência de 4 tentativas fracassadas " +
      "(v10-v13) onde a function chat-ia nunca rodou de fato por " +
      "problemas de CORS/verify_jwt/redeploy do Lovable. CF Worker " +
      "deployado via wrangler em " +
      "my-home-treasure-box-ai.renatodevita.workers.dev (grátis, 100k " +
      "req/dia). Mesmo modelo (GPT-4o), mesmas 6 tools, mesma interface " +
      "pro frontend — só mudou a URL em `src/lib/ai-chat.ts`. Código " +
      "do Worker em `cloudflare-worker/`. supabase/functions/chat-ia " +
      "fica órfão (será deletado em PR cleanup futuro junto com " +
      "chat-global, chat-property e ai-stream.ts).",
  },
  {
    version: "v13",
    date: "10/mai/2026",
    notes:
      "Force redeploy do chat-ia pra Lovable pegar o config.toml novo do " +
      "v12. Mudança só em config.toml não aciona redeploy de edge function " +
      "— só mudança no index.ts força. Adicionado um DEPLOYMENT_MARKER no " +
      "topo do chat-ia/index.ts pra trigger redeploy. Este é o mesmo " +
      "padrão que funcionou no v2 (deployment marker da edge function que " +
      "Lovable insistia em não redeployar).",
  },
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
