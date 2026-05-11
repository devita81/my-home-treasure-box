// Filtros locais aplicados aos listings do ZAP NO FRONTEND, depois
// que a edge function devolve a resposta. Duplica a lógica que a
// edge function `fetch-zap-listings` deveria estar aplicando, mas
// como o pipeline de redeploy do Lovable se mostrou inconfiável (4
// tentativas falhas), centralizamos aqui no frontend onde os deploys
// funcionam.
//
// Quando o pipeline de edge function virar confiável, os filtros
// daqui podem ser removidos sem perda funcional (a edge function
// faria o mesmo trabalho upstream). Mantê-los aqui custa quase nada
// e serve como camada extra de segurança.

import type { ZapListing } from "@/hooks/useZapListings";

/**
 * Conjunto de labels do `listing.name` que aceitamos como comparável
 * para um dado `tipo_imovel` cadastrado.
 *
 * O ideal seria filtrar pelo `unitType` cru (APARTMENT, HOME, etc.),
 * mas a edge function rotula esses como labels traduzidos no campo
 * `name` ("Apartamento · 3q · 122m²"). Portanto comparamos pelo que
 * está disponível.
 *
 * Para tipos que o ZAP costuma rotular como "Imóvel" genérico
 * (terreno, conjunto comercial, garagem) retornamos `null` —
 * filtragem por label seria muito frágil. Nesses casos, NÃO filtramos
 * por tipo no frontend; o filtro server-side (mesmo flaky) ainda
 * acerta na maior parte dos casos.
 */
function getLabelsAceitaveis(
  tipo: string | null | undefined,
): Set<string> | null {
  if (!tipo) return null;
  switch (tipo.toLowerCase().trim()) {
    case "apartamento":
      return new Set(["Apartamento"]);
    case "casa":
      return new Set(["Casa"]);
    default:
      return null; // terreno / conjunto_comercial / garagem / outros
  }
}

/** Extrai o label do tipo no início do `name` ("Apartamento · 3q ·…" → "Apartamento"). */
function extractTipoLabel(name: string): string {
  const idx = name.indexOf(" · ");
  return idx >= 0 ? name.substring(0, idx).trim() : name.trim();
}

export interface ZapFilterInput {
  listings: ZapListing[];
  tipo_imovel: string | null | undefined;
  /** Área útil cadastrada em m² — driver do range progressivo. */
  metragem: number | null | undefined;
}

export interface ZapFilterDebug {
  tipo_cadastrado: string | null;
  metragem_cadastrada: number | null;
  labels_aceitos: string[] | null;
  labels_observados: string[];
  range_aplicado: "±30%" | "±50%" | null;
  limites: [number, number] | null;
  total_recebido: number;
  apos_filtro_tipo: number;
  apos_filtro_area: number;
}

export interface ZapFilterResult {
  listings: ZapListing[];
  debug: ZapFilterDebug;
}

/**
 * Aplica filtros de tipo + área (range progressivo ±30/50%) na
 * resposta ZAP. Retorna a lista filtrada + um struct de diagnóstico
 * pra debug visível no console do navegador.
 *
 * Estratégia de área (range progressivo):
 *   1. Tenta ±30% — se sobrarem ≥3, usa
 *   2. Senão tenta ±50% (cap final — pra 83m² isso vira 41-124m²,
 *      ainda razoável; descartamos o ±100% antigo que aceitava 2x
 *      o tamanho do imóvel e o usuário percebia como "fora")
 *
 * Listings sem `floorSize` são SEMPRE descartados quando o usuário
 * informou metragem — não dá pra confirmar se são comparáveis.
 *
 * Se nem ±50% conseguir 3, devolve mesmo assim o que veio em ±50%
 * (pode ser 0, 1 ou 2). Lista vazia é OK — UI mostra "sem
 * comparáveis dentro da faixa" em vez de poluir com listings
 * grosseiramente fora.
 */
export function filterZapListings(input: ZapFilterInput): ZapFilterResult {
  const { listings, tipo_imovel, metragem } = input;

  const labelsAceitos = getLabelsAceitaveis(tipo_imovel);
  const labelsObservados = [
    ...new Set(listings.map((l) => extractTipoLabel(l.name))),
  ];

  // Filtro de TIPO
  let filtered = listings;
  if (labelsAceitos) {
    filtered = listings.filter((l) =>
      labelsAceitos.has(extractTipoLabel(l.name)),
    );
  }
  const aposFiltroTipo = filtered.length;

  // Filtro de ÁREA (range progressivo)
  let rangeAplicado: ZapFilterDebug["range_aplicado"] = null;
  let limites: [number, number] | null = null;
  if (typeof metragem === "number" && metragem > 0) {
    const ranges: Array<{ pct: number; label: ZapFilterDebug["range_aplicado"] }> = [
      { pct: 0.3, label: "±30%" },
      { pct: 0.5, label: "±50%" },
    ];
    for (const r of ranges) {
      const min = metragem * (1 - r.pct);
      const max = metragem * (1 + r.pct);
      const candidatos = filtered.filter(
        (l) =>
          typeof l.floorSize === "number" &&
          l.floorSize >= min &&
          l.floorSize <= max,
      );
      // Para no primeiro range que entrega ≥3 comparáveis, OU no
      // último range testado (cap final = ±50%). Antes o cap era
      // ±100% que aceitava o dobro do tamanho — wide demais.
      if (candidatos.length >= 3 || r.pct === 0.5) {
        filtered = candidatos;
        rangeAplicado = r.label;
        limites = [Math.round(min), Math.round(max)];
        break;
      }
    }
  }

  return {
    listings: filtered,
    debug: {
      tipo_cadastrado: tipo_imovel ?? null,
      metragem_cadastrada: metragem ?? null,
      labels_aceitos: labelsAceitos ? [...labelsAceitos] : null,
      labels_observados: labelsObservados,
      range_aplicado: rangeAplicado,
      limites,
      total_recebido: listings.length,
      apos_filtro_tipo: aposFiltroTipo,
      apos_filtro_area: filtered.length,
    },
  };
}
