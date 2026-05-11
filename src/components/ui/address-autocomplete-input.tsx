import { useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAddressAutocomplete } from "@/hooks/useAddressAutocomplete";
import type { AddressSuggestion } from "@/lib/nominatim";

interface AddressAutocompleteInputProps {
  /** Valor atual do input (controlado). */
  value: string;
  /** Disparado a cada keystroke (digitação manual). */
  onChange: (value: string) => void;
  /** Disparado quando usuário clica numa sugestão. Recebe o objeto
   *  completo — quem usa decide quais campos preencher. */
  onSelect: (s: AddressSuggestion) => void;
  /** Filtros contextuais — restringe sugestões a esta cidade/estado. */
  contextCidade?: string;
  contextEstado?: string;

  // Passthrough pro <Input> de baixo
  id?: string;
  placeholder?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  "aria-required"?: boolean | "true" | "false";
}

/**
 * Input com dropdown de sugestões de endereço (via Nominatim). Reusável
 * entre o formulário de cadastro de imóvel e a página de Pesquisa
 * pontual de preço.
 *
 * Comportamento:
 *   1. Usuário digita rua → 500ms parado → request Nominatim
 *   2. Dropdown mostra até 5 sugestões com endereço completo
 *   3. Click numa sugestão → `onSelect(suggestion)` é chamado com
 *      { rua, bairro, cidade, estado, cep, lat, lon } resolvidos
 *   4. Após selecionar, o dropdown não reabre enquanto o usuário não
 *      mexer no input de novo (evita busca em loop)
 *
 * Limitação conhecida: Nominatim é gratuito mas limita 1 req/s. O
 * debounce de 500ms + abort de requests anteriores cobre uso típico.
 * Se você digitar muito rápido, algumas buscas são descartadas — é OK.
 */
export function AddressAutocompleteInput({
  value,
  onChange,
  onSelect,
  contextCidade,
  contextEstado,
  id,
  placeholder,
  className,
  required,
  disabled,
  "aria-required": ariaRequired,
}: AddressAutocompleteInputProps) {
  const [focused, setFocused] = useState(false);
  const [picked, setPicked] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { suggestions, loading } = useAddressAutocomplete(value, {
    cidade: contextCidade,
    estado: contextEstado,
    enabled: focused && !picked,
  });

  const showDropdown = focused && !picked && (suggestions.length > 0 || loading);

  const handleSelect = (s: AddressSuggestion) => {
    setPicked(true);
    setFocused(false);
    onSelect(s);
  };

  return (
    <div ref={containerRef} className="relative">
      <Input
        id={id}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          // Voltar a permitir busca quando o user mexe no campo
          // depois de já ter selecionado uma sugestão (ex: corrigindo)
          if (picked) setPicked(false);
        }}
        onFocus={() => setFocused(true)}
        // Delay no blur pra dar tempo do click no item do dropdown
        // disparar antes do dropdown fechar
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder={placeholder}
        className={cn("pr-8", className)}
        required={required}
        aria-required={ariaRequired}
        disabled={disabled}
        autoComplete="off"
      />
      {loading ? (
        <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        </div>
      ) : null}
      {showDropdown && suggestions.length > 0 ? (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-auto rounded-md border border-border bg-card shadow-lg"
        >
          {suggestions.map((s) => (
            <li key={s.id} role="option" aria-selected="false">
              <button
                type="button"
                onMouseDown={(e) => {
                  // mousedown (não click) pra disparar ANTES do onBlur
                  // do input fechar o dropdown
                  e.preventDefault();
                  handleSelect(s);
                }}
                className="flex w-full items-start gap-2 px-3 py-2 text-left text-label hover:bg-secondary focus:bg-secondary focus:outline-none"
              >
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 break-words">{s.displayName}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {showDropdown && suggestions.length === 0 && !loading ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border border-border bg-card px-3 py-2 text-label text-muted-foreground shadow-lg">
          Sem sugestões. Continue digitando ou preencha manualmente.
        </div>
      ) : null}
    </div>
  );
}
