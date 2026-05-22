// Botão "Exportar PDF" — orquestra o pipeline de exportação.
//
// Fluxo:
//   1. Garante que a Análise profunda foi gerada (compartilha cache
//      com a AnaliseProfunda via useAnaliseProfunda — não duplica a
//      chamada ao Worker /research que custa ~R$ 1).
//   2. Monta `<PdfExportSurface>` off-screen — agora minimal, só com o
//      GraficoItbi pra captura via html2canvas.
//   3. Aguarda 500ms (Recharts terminar de medir/animar).
//   4. Chama `buildAnalisePdf` que faz render NATIVO de header + cards
//      + tabela ITBI + markdown da profunda + fontes + footer com
//      numeração de página. O chart é capturado off-screen e embedado.
//   5. Entrega o Blob via `deliverPdfBlob` (mobile: Web Share API,
//      desktop: download direto).
//
// Diferença pro v32: o PDF antigo era screenshot único multi-página,
// com bordas borradas pela compressão JPEG e page-breaks no meio de
// seções. Agora texto é selecionável, bordas são nítidas e os page-
// breaks respeitam fronteiras de bloco.

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { deliverPdfBlob } from "@/lib/pdf-delivery";
import { buildAnalisePdf, buildPdfFileName } from "@/lib/export-analise-pdf";
import { useAnaliseProfunda } from "./dados/useAnaliseProfunda";
import { PdfExportSurface } from "./pdf/PdfExportSurface";
import type { DadosAnalisePreco } from "./dados/tipos";
import type { Property } from "@/types/property";

interface BotaoExportarPdfProps {
  property: Property;
  dados: DadosAnalisePreco;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type FaseExport =
  | "idle"
  | "gerando-profunda"
  | "preparando"
  | "renderizando-pdf";

export function BotaoExportarPdf({ property, dados }: BotaoExportarPdfProps) {
  const profunda = useAnaliseProfunda(property);
  const [fase, setFase] = useState<FaseExport>("idle");
  const surfaceRef = useRef<HTMLDivElement | null>(null);

  const handleClick = async () => {
    if (fase !== "idle") return;

    try {
      // 1. Garante Análise profunda
      if (!profunda.result) {
        setFase("gerando-profunda");
        toast.info(
          "Gerando análise profunda primeiro… isso leva 60-120 segundos.",
        );
        try {
          await profunda.run();
        } catch (e) {
          toast.error(
            e instanceof Error
              ? `Falha na Análise profunda: ${e.message}`
              : "Falha na Análise profunda",
          );
          setFase("idle");
          return;
        }
      }

      // Re-read result após state.run() (state hook atualizou no
      // success). Se ainda assim for null, abortamos.
      const resultProfunda = profunda.result;
      if (!resultProfunda) {
        toast.error("Análise profunda indisponível após geração — reload e tente de novo.");
        setFase("idle");
        return;
      }

      // 2. Monta surface off-screen (só o chart)
      setFase("preparando");
      await sleep(500); // Recharts mede + renderiza

      // 3. Pega o elemento do chart (pode ser null se ITBI = 0 pts)
      setFase("renderizando-pdf");
      const chartEl = surfaceRef.current?.querySelector<HTMLElement>(
        "[data-pdf-chart]",
      ) ?? null;

      // 4. Render do PDF nativo
      const { blob, pageCount } = await buildAnalisePdf({
        property,
        dadosItbi: dados.itbi,
        profundaResult: resultProfunda,
        chartElement: chartEl,
      });
      console.log(
        `[BotaoExportarPdf] PDF gerado: ${pageCount} páginas, ${(
          blob.size / 1024
        ).toFixed(0)}KB`,
      );

      // 5. Entrega
      const fileName = buildPdfFileName({
        rua: property.rua,
        numero: property.numero,
        bairro: property.bairro,
        cidade: property.cidade,
      });
      const resultado = await deliverPdfBlob(blob, fileName);

      if (resultado !== "cancelled") {
        toast.success(
          resultado === "shared"
            ? "PDF compartilhado"
            : "PDF baixado — confira na pasta de Downloads",
        );
      }
    } catch (e) {
      logger.error("[BotaoExportarPdf] erro:", e);
      toast.error(
        e instanceof Error ? e.message : "Erro ao exportar PDF",
      );
    } finally {
      setFase("idle");
    }
  };

  const label = (() => {
    switch (fase) {
      case "gerando-profunda":
        return "Pesquisando análise…";
      case "preparando":
        return "Preparando PDF…";
      case "renderizando-pdf":
        return "Gerando PDF…";
      default:
        return "Exportar PDF";
    }
  })();

  const loading = fase !== "idle";

  return (
    <>
      <Button
        onClick={handleClick}
        disabled={loading}
        variant="outline"
        size="sm"
        className="gap-2"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        <span className="hidden sm:inline">{label}</span>
        <span className="sm:hidden">{loading ? "Gerando…" : "PDF"}</span>
      </Button>

      {/* Surface off-screen — montado SÓ durante o export, com o chart
          ITBI pra captura. Pra fora do React tree via portal pra evitar
          que overflow:hidden de algum ancestral clipe o screenshot. */}
      {(fase === "preparando" || fase === "renderizando-pdf") &&
        createPortal(
          <div ref={surfaceRef} aria-hidden>
            <PdfExportSurface
              dadosItbi={dados.itbi}
              dadosEstimativaIa={dados.estimativaIa}
            />
          </div>,
          document.body,
        )}
    </>
  );
}
