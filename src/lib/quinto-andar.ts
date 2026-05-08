import type { Property } from '@/types/property';

/**
 * Builds a QuintoAndar search URL pointing directly at a refined results
 * page (no Bing detour). Includes the property's bairro in the path slug
 * and adds query params for type and bedroom count when available.
 *
 * URL format reverse-engineered from QuintoAndar's public site, e.g.:
 *   https://www.quintoandar.com.br/comprar/imovel/jardim-paulista-sao-paulo-sp-brasil
 *
 * If a query param name is wrong (their filter naming may evolve), the
 * URL still lands on the bairro page — user just sees broader results.
 */

export type QuintoAndarSearchType = 'venda' | 'aluguel';

const slugify = (text: string): string =>
  text
    // NFD splits accented chars into base + combining mark, then \p{M}
    // matches any Unicode combining mark — strips São→Sao, café→cafe.
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // non-alphanumerics become a single dash
    .replace(/^-|-$/g, ''); // trim leading/trailing dashes

export function buildQuintoAndarSearchUrl(
  property: Pick<Property, 'cidade' | 'estado' | 'bairro' | 'tipo_imovel' | 'quartos'>,
  type: QuintoAndarSearchType,
): string {
  const action = type === 'venda' ? 'comprar' : 'alugar';
  const cidadeSlug = slugify(property.cidade);
  const estadoSlug = property.estado.toLowerCase();
  const bairroSlug = property.bairro ? slugify(property.bairro) : null;

  // Path slug — bairro included when known, otherwise just city.
  const pathSlug = bairroSlug
    ? `${bairroSlug}-${cidadeSlug}-${estadoSlug}-brasil`
    : `${cidadeSlug}-${estadoSlug}-brasil`;

  const url = new URL(`https://www.quintoandar.com.br/${action}/imovel/${pathSlug}`);

  // Filter by property type. QuintoAndar uses Portuguese param values.
  // Map our internal types to the values their site recognizes.
  const tipoMap: Record<string, string> = {
    apartamento: 'apartamento',
    casa: 'casa',
  };
  if (property.tipo_imovel) {
    const qaType = tipoMap[property.tipo_imovel.toLowerCase()];
    if (qaType) url.searchParams.set('tipos', qaType);
  }

  // Bedroom count filter
  if (property.quartos && property.quartos > 0) {
    url.searchParams.set('quartos', String(property.quartos));
  }

  return url.toString();
}
