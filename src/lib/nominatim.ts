// Cliente da API pública do Nominatim (OpenStreetMap) — usado pelo
// autocomplete de endereço no formulário de imóvel e na Pesquisa
// pontual de preço. Grátis, sem API key, mas com rate limit de 1
// req/segundo por IP — por isso o uso é sempre debounceado pelo lado
// chamador (`useAddressAutocomplete`).
//
// Por que Nominatim e não Google Places: zero setup, zero custo, dados
// suficientes pra resolver `rua → bairro/cidade/estado/cep/lat/lon` em
// endereços urbanos brasileiros. Se a qualidade não bastar, dá pra
// migrar pra Google Places mais tarde — a interface aqui é simples.

interface NominatimRawResult {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    road?: string;
    pedestrian?: string;
    house_number?: string;
    suburb?: string;
    neighbourhood?: string;
    city?: string;
    town?: string;
    municipality?: string;
    state?: string;
    postcode?: string;
  };
}

export interface AddressSuggestion {
  /** ID único do Nominatim — usado como key do React. */
  id: number;
  /** Texto completo pra mostrar no dropdown. */
  displayName: string;
  rua: string;
  bairro: string;
  cidade: string;
  /** UF 2 letras (SP, RJ, etc) — normalizado de "São Paulo" via UF_MAP. */
  estado: string;
  /** CEP só dígitos (sem hífen). Pode vir vazio. */
  cep: string;
  lat: number;
  lon: number;
}

// Nominatim retorna o nome completo do estado em português, mas o
// resto do app trabalha com UF 2 letras. Mapa pra normalizar.
const UF_MAP: Record<string, string> = {
  Acre: "AC",
  Alagoas: "AL",
  Amapá: "AP",
  Amazonas: "AM",
  Bahia: "BA",
  Ceará: "CE",
  "Distrito Federal": "DF",
  "Espírito Santo": "ES",
  Goiás: "GO",
  Maranhão: "MA",
  "Mato Grosso": "MT",
  "Mato Grosso do Sul": "MS",
  "Minas Gerais": "MG",
  Pará: "PA",
  Paraíba: "PB",
  Paraná: "PR",
  Pernambuco: "PE",
  Piauí: "PI",
  "Rio de Janeiro": "RJ",
  "Rio Grande do Norte": "RN",
  "Rio Grande do Sul": "RS",
  Rondônia: "RO",
  Roraima: "RR",
  "Santa Catarina": "SC",
  "São Paulo": "SP",
  Sergipe: "SE",
  Tocantins: "TO",
};

interface SearchOptions {
  /** Filtra resultados nesta cidade. Concatena na query. */
  cidade?: string;
  /** Filtra resultados neste estado (UF). Concatena na query. */
  estado?: string;
  /** Abortável quando o user digita de novo — debounce + abort previne corrida. */
  signal?: AbortSignal;
}

/**
 * Busca sugestões de endereço no Nominatim. Sem cache (cada chamada
 * vai pra rede), porque o debounce upstream já reduz frequência.
 *
 * Erros silenciosos: retorna `[]` em qualquer falha. UI mostra "sem
 * sugestões" e usuário pode digitar manualmente — não bloqueia o form.
 */
export async function searchAddresses(
  query: string,
  options: SearchOptions = {},
): Promise<AddressSuggestion[]> {
  if (query.trim().length < 3) return [];

  const parts = [query.trim()];
  if (options.cidade?.trim()) parts.push(options.cidade.trim());
  if (options.estado?.trim()) parts.push(options.estado.trim());
  parts.push("Brasil");
  const q = parts.join(", ");

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("countrycodes", "br");
  url.searchParams.set("limit", "5");

  try {
    const resp = await fetch(url.toString(), {
      headers: { "Accept-Language": "pt-BR" },
      signal: options.signal,
    });
    if (!resp.ok) return [];
    const json = (await resp.json()) as NominatimRawResult[];

    return json
      .map<AddressSuggestion>((r) => {
        const a = r.address ?? {};
        return {
          id: r.place_id,
          displayName: r.display_name,
          rua: a.road ?? a.pedestrian ?? "",
          bairro: a.suburb ?? a.neighbourhood ?? "",
          cidade: a.city ?? a.town ?? a.municipality ?? "",
          estado: UF_MAP[a.state ?? ""] ?? "",
          cep: (a.postcode ?? "").replace(/\D/g, ""),
          lat: Number(r.lat),
          lon: Number(r.lon),
        };
      })
      // Filtra resultados sem rua identificada — não servem pra autocomplete
      // de endereço residencial (provavelmente bairros, parques, etc).
      .filter((s) => s.rua.length > 0);
  } catch (err) {
    // AbortError é esperado durante typing — silencioso. Outros erros
    // também silenciosos pra não interromper UX (usuário digita manual).
    if (err instanceof Error && err.name !== "AbortError") {
      console.warn("Nominatim error (silencioso):", err.message);
    }
    return [];
  }
}
