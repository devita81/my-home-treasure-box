import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import type { Property } from "@/types/property";
import type { ItbiResult } from "@/components/itbi/itbi-stats";
import type { AreaBucket } from "@/components/property/market-stats";
import { useAnalisePreco } from "./dados/useAnalisePreco";
import type { FontePreco, PontoPreco } from "./dados/tipos";
import { AnalisePrecoHeader } from "./AnalisePrecoHeader";
import { AnaliseProfunda } from "./AnaliseProfunda";
import { ComparativoFontes } from "./comparativo/ComparativoFontes";
import { GraficosLado } from "./graficos/GraficosLado";
import { FiltrosPreco } from "./filtros/FiltrosPreco";
import { GradeResultados } from "./resultados/GradeResultados";
import { ModalTransacaoItbi } from "./detalhes/ModalTransacaoItbi";
import { DialogAnaliseIa } from "./detalhes/DialogAnaliseIa";

interface AnalisePrecoProps {
  property: Property;
}

/**
 * Seção "Análise de Preço" da página de detalhes — substitui os
 * antigos blocos `MarketListings`, `PropertyItbiBlock` e o card
 * "Estimativas IA". Apresenta as 3 fontes (ITBI / Anúncios / IA)
 * de forma normalizada: comparativo no topo, gráficos lado a lado,
 * filtros, e uma grade unificada de resultados.
 *
 * Toda a lógica de fetch/cache vive em `dados/`. Esse componente
 * só conecta os pedaços de UI.
 */
export function AnalisePreco({ property }: AnalisePrecoProps) {
  const dados = useAnalisePreco(property);

  const [faixaArea, setFaixaArea] = useState<AreaBucket | null>(null);
  const [fontesAtivas, setFontesAtivas] = useState<Set<FontePreco>>(
    () => new Set<FontePreco>(["itbi", "anuncios", "estimativa_ia"]),
  );

  // Estado dos modais de drill-down. Apenas um aberto por vez.
  const [modalItbi, setModalItbi] = useState<ItbiResult | null>(null);
  const [modalIa, setModalIa] = useState<string | null>(null);

  const contagens = useMemo(
    () => ({
      itbi: dados.itbi.pontos.length,
      anuncios: dados.anuncios.pontos.length,
      estimativa_ia: dados.estimativaIa.pontos.length,
    }),
    [dados],
  );

  const algumLoading =
    dados.itbi.isLoading ||
    dados.anuncios.isLoading ||
    dados.estimativaIa.isLoading;

  const handlePontoClick = (p: PontoPreco) => {
    if (p.acao.tipo === "modal-itbi") {
      setModalItbi(p.acao.transacao as ItbiResult);
    } else if (p.acao.tipo === "modal-ia") {
      setModalIa(p.acao.markdown);
    } else if (p.acao.tipo === "externo") {
      window.open(p.acao.href, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="space-y-4">
      {/* Análise profunda fica em Card SEPARADO acima do principal pra
          ter identidade visual própria. Trade-off: ocupa mais espaço
          vertical, mas o usuário entende que é uma feature distinta
          (Claude + web search) e não outra "estimativa" no meio das
          outras 3 fontes (ITBI/Anúncios/IA single-shot). */}
      <AnaliseProfunda property={property} />

      <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="h-5 w-5 text-primary" />
          Análise de preço
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <AnalisePrecoHeader
          modo={dados.modo}
          setModo={dados.setModo}
          onRefetchTudo={dados.refetchTudo}
          isLoading={algumLoading}
        />

        <ComparativoFontes
          dados={dados}
          onVerAnaliseIa={() =>
            dados.estimativaIa.markdown &&
            setModalIa(dados.estimativaIa.markdown)
          }
        />

        <GraficosLado dados={dados} onPontoClick={handlePontoClick} />

        <FiltrosPreco
          faixaArea={faixaArea}
          setFaixaArea={setFaixaArea}
          fontesAtivas={fontesAtivas}
          setFontesAtivas={setFontesAtivas}
          contagens={contagens}
        />

        <GradeResultados
          dados={dados}
          faixaArea={faixaArea}
          fontesAtivas={fontesAtivas}
          onPontoClick={handlePontoClick}
        />
      </CardContent>

      {/* Modais — controlados aqui no top-level pra que `<GradeResultados>`
          e `<ComparativoFontes>` não dupliquem estado de modal. */}
      <ModalTransacaoItbi
        transacao={modalItbi}
        onClose={() => setModalItbi(null)}
      />
      <DialogAnaliseIa markdown={modalIa} onClose={() => setModalIa(null)} />
      </Card>
    </div>
  );
}
