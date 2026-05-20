// Contrato compartilhado entre os três adapters de fonte de preço
// (ITBI / Anúncios / Estimativa IA) e os componentes de UI da
// AnalisePreco. A ideia é normalizar três fontes muito diferentes
// num único shape de "ponto" para que o gráfico, o card de resumo,
// os filtros e a grade de resultados não precisem saber de onde
// veio o dado — só renderizar.

import type { PriceStats } from "@/lib/price-stats";

/** As três fontes de dado de preço suportadas hoje. */
export type FontePreco = "itbi" | "anuncios" | "estimativa_ia";

/** Modo de busca — não é toda fonte que tem aluguel (ITBI só tem venda). */
export type ModoPreco = "venda" | "aluguel";

/**
 * Um ponto de preço normalizado. Cada adapter converte sua resposta
 * nativa nesse shape — ITBI vira N pontos (um por transação), ZAP
 * vira N pontos (um por anúncio), IA vira até 3 pontos por modo
 * (mín / médio / máx).
 */
export interface PontoPreco {
  /** Único dentro da fonte; usar como `key`. */
  id: string;
  fonte: FontePreco;
  modo: ModoPreco;
  /** Preço em BRL. Sempre positivo. */
  preco: number;
  /** Metragem em m². Opcional — IA não tem dimensão. */
  area?: number;
  /** ISO date — só ITBI e anúncios têm; IA não. */
  data?: string;
  /**
   * Contexto que o `<CardResultado>` mostra abaixo do preço. Cada
   * fonte preenche com o que faz sentido pra ela.
   */
  display: {
    /** Linha 1 abaixo do preço. Ex: "jul/25", "Loft moderno", "Estimativa média". */
    primary: string;
    /** Linha 2, opcional. Ex: "4º andar", "Vila Madalena". */
    secondary?: string;
  };
  /**
   * O que acontece quando o usuário clica no card. Modal interno
   * (ITBI: detalhes da transação; IA: análise completa do GPT) ou
   * URL externa (anúncio do ZAP).
   */
  acao:
    | { tipo: "modal-itbi"; transacao: unknown }
    | { tipo: "modal-ia"; markdown: string }
    | { tipo: "externo"; href: string };
}

/**
 * Resultado de cada adapter — o que o `useAnalisePreco` orquestra.
 * `stats` é a faixa-padrão (usada no `CardResumoFonte`); `pontos` é
 * a base do gráfico e da grade de resultados.
 */
export interface DadosFonte {
  fonte: FontePreco;
  /** Pra UI mostrar "Histórico ITBI", "Anúncios ZAP", etc. */
  rotulo: string;
  /** Ex: "Prefeitura de São Paulo", "ZAP Imóveis", "ChatGPT". */
  origem: string;
  /** Pontos para o gráfico + grade. Vazio se ainda não carregado. */
  pontos: PontoPreco[];
  /** Estatísticas-resumo. Calculadas a partir de `pontos.preco`. */
  stats: PriceStats & {
    /** Último preço (mais recente). Só ITBI/anúncios têm. */
    ultimoPreco?: number | null;
    /** Data do último — formato ISO. */
    ultimaData?: string | null;
  };
  /** Quando o dado foi buscado pela última vez. ISO. */
  asOf: string | null;
  isLoading: boolean;
  isError: boolean;
  /** Mensagem quando `isError` ou quando faz sentido mostrar. */
  errorMessage?: string;
  /**
   * Fonte externa indisponível por bloqueio (anti-bot, rate-limit
   * permanente, etc) — distinto de `isError` porque é um estado
   * conhecido e gracioso. Hoje só Anúncios ZAP usa, quando o
   * Cloudflare da ZAP devolve 403. UI mostra mensagem honesta + link
   * pro site externo em vez de "Sem dados" enigmático.
   */
  bloqueado?: {
    motivo: string;
    /** URL pra abrir a busca direto no site externo. */
    href?: string;
  };
  /** Dispara nova busca + atualiza cache. */
  refetch: () => void;
  /**
   * Link "Ver mais →" quando essa fonte tem uma página dedicada
   * para deep-dive (ITBI tem `/itbi-search`, ZAP tem o site externo).
   */
  verMaisHref?: string;
  /**
   * Markdown bruto retornado pela fonte — só preenchido pela IA hoje.
   * Permite o "Ver análise completa →" no `CardResumoFonte`.
   */
  markdown?: string | null;
}

/**
 * Estado completo da `<AnalisePreco>`. O `useAnalisePreco` retorna
 * isso. Os componentes de UI consomem.
 */
export interface DadosAnalisePreco {
  modo: ModoPreco;
  setModo: (m: ModoPreco) => void;
  itbi: DadosFonte;
  anuncios: DadosFonte;
  estimativaIa: DadosFonte;
  /** Atualiza tudo simultaneamente. */
  refetchTudo: () => void;
}
