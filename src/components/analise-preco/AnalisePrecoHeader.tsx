import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ModoPreco } from "./dados/tipos";

interface AnalisePrecoHeaderProps {
  modo: ModoPreco;
  setModo: (m: ModoPreco) => void;
  onRefetchTudo: () => void;
  isLoading: boolean;
}

const ACTIVE_TAB =
  "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm";

/**
 * Cabeçalho da `<AnalisePreco>`: tabs Venda/Aluguel + botão
 * "Atualizar tudo" que dispara as 3 fontes em paralelo.
 *
 * O ITBI ignora o modo aluguel (sempre vende) — quem decide é cada
 * adapter, não o header. Aqui só propagamos a escolha do usuário.
 */
export function AnalisePrecoHeader({
  modo,
  setModo,
  onRefetchTudo,
  isLoading,
}: AnalisePrecoHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Tabs value={modo} onValueChange={(v) => setModo(v as ModoPreco)}>
        <TabsList className="grid w-full grid-cols-2 sm:w-auto">
          <TabsTrigger value="venda" className={ACTIVE_TAB}>
            Venda
          </TabsTrigger>
          <TabsTrigger value="aluguel" className={ACTIVE_TAB}>
            Aluguel
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <Button
        onClick={onRefetchTudo}
        disabled={isLoading}
        variant="outline"
        size="sm"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Atualizando…
          </>
        ) : (
          <>
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar tudo
          </>
        )}
      </Button>
    </div>
  );
}
