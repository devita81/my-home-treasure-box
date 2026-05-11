import { useEffect, useState } from "react";
import { searchAddresses, type AddressSuggestion } from "@/lib/nominatim";

interface UseAddressAutocompleteOptions {
  /** Filtro contextual — restringe sugestões a esta cidade. */
  cidade?: string;
  /** Filtro contextual — restringe sugestões a este estado (UF). */
  estado?: string;
  /** Debounce em ms. Default 500ms — Nominatim limita 1 req/s por IP. */
  debounceMs?: number;
  /** Quando false, pausa a busca (ex: depois que usuário já escolheu). */
  enabled?: boolean;
}

interface UseAddressAutocompleteResult {
  suggestions: AddressSuggestion[];
  loading: boolean;
}

/**
 * Hook que dispara busca debounceada no Nominatim quando `query` muda.
 *
 * Padrão de uso típico:
 *   const [rua, setRua] = useState('')
 *   const [picked, setPicked] = useState(false)
 *   const { suggestions, loading } = useAddressAutocomplete(rua, {
 *     cidade, estado, enabled: !picked
 *   })
 *
 * O flag `enabled: !picked` evita que a busca continue depois que o
 * usuário já selecionou uma sugestão — sem isso, o ato de preencher o
 * input com o resultado dispararia uma nova busca em loop.
 *
 * Abort: cada nova query aborta a anterior — previne race condition
 * onde uma resposta lenta sobrescreve uma mais nova.
 */
export function useAddressAutocomplete(
  query: string,
  options: UseAddressAutocompleteOptions = {},
): UseAddressAutocompleteResult {
  const { cidade, estado, debounceMs = 500, enabled = true } = options;
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);

    const timer = setTimeout(async () => {
      const results = await searchAddresses(trimmed, {
        cidade,
        estado,
        signal: controller.signal,
      });
      if (!controller.signal.aborted) {
        setSuggestions(results);
        setLoading(false);
      }
    }, debounceMs);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, cidade, estado, debounceMs, enabled]);

  return { suggestions, loading };
}
