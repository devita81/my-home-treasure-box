// Botão "Exportar PDF" — orquestra todo o pipeline de exportação.
//
// Fluxo quando clicado:
//   1. Garante que a Análise profunda foi gerada (compartilha cache
//      com a AnaliseProfunda via useAnaliseProfunda hook — não
//      duplica chamada). Se ainda não gerada, dispara state.run().
//   2. Monta `<PdfExportSurface>` off-screen (visible: hidden no DOM
//      mas posicionado fora da viewport pra ser capturado).
//   3. Aguarda 600ms — tempo de Recharts animar/medir o gráfico ITBI
//      e o react-markdown renderizar o conteúdo todo.
//   4. Chama `buildAnalisePdf` → html2canvas + jsPDF multi-página.
//   5. Entrega o Blob via `deliverPdfBlob` (mobile: Web Share API;
//      desktop: download direto).
//   6. Desmonta o surface.
//
// Estados visíveis no botão:
//   • Normal: "Exportar PDF" + ícone
//   • Gerando análise profunda (se não existe ainda): "Pesquisando…"
//   • Montando PDF: "Gerando PDF…"
//   • Erro: toast (sonner)

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Download, FileText, Loader2 } from "lucide-react";
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

/**
 * `wait` simples, baseado em setTimeout. Usado pra dar tempo do React
 * commitar o surface e do Recharts terminar o resize/animação antes
 * do html2canvas. Tempo conservador (600ms) — preferimos delay > falha.
 */
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type FaseExport =
  | "idle"
  | "gerando-profunda"
  | "preparando"
  | "renderizando-pdf";

export function BotaoExportarPdf({ property, dados }: BotaoExportarPdfProps) {
  const profunda = useAnaliseProfunda(property);
  const [fase, setFase] = useState<FaseExport>("idle");
  // Ref pro container off-screen do surface — usado pelo html2canvas
  const surfaceRef = useRef<HTMLDivElement | null>(null);

  const handleClick = async () => {
    if (fase !== "idle") return;

    try {
      // 1. Garante que a Análise profunda existe
      let resultProfunda = profunda.result;
      if (!resultProfunda) {
        setFase("gerando-profunda");
        toast.info(
          "Gerando análise profunda primeiro… isso leva 60-120 segundos.",
        );
        try {
          resultProfunda = await profunda.run();
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

      // 2. Monta o surface — flip de state pra renderizar
      setFase("preparando");

      // 3. Aguarda o DOM commitar + Recharts/markdown renderizarem.
      // 600ms é conservador mas confiável. Antes disso o canvas pode
      // capturar gráfico em branco.
      await sleep(600);

      // 4. Renderiza PDF
      setFase("renderizando-pdf");
      const surfaceEl = surfaceRef.current?.querySelector<HTMLElement>(
        "[data-pdf-surface]",
      );
      if (!surfaceEl) {
        throw new Error("Surface não encontrada no DOM — bug interno");
      }

      const { blob, pageCount } = await buildAnalisePdf({
        surfaceElement: surfaceEl,
      });
      // log de sucesso é benigno (mesmo padrão de [Anuncios] filtro
      // frontend) — logger.ts só expõe error/warn em dev, então uso
      // console.log direto pra info de tracking
      console.log(
        `[BotaoExportarPdf] PDF gerado: ${pageCount} páginas, ${(
          blob.size / 1024
        ).toFixed(0)}KB`,
      );

      // 5. Entrega — mobile abre share sheet, desktop baixa
      const fileName = buildPdfFileName({
        rua: property.rua,
        numero: property.numero,
        bairro: property.bairro,
        cidade: property.cidade,
      });
      const resultado = await deliverPdfBlob(blob, fileName);

      if (resultado === "cancelled") {
        // user fechou o share sheet — fica quieto
      } else {
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

  // Texto do botão muda conforme a fase
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
        {/* Em mobile pequeno, só ícone + label curto pra economizar
            espaço. PDF é ação secundária, não precisa label completo. */}
        <span className="sm:hidden">
          {loading ? "Gerando…" : "PDF"}
        </span>
      </Button>

      {/* Surface off-screen montado SÓ durante export. Usa portal pra
          fugir do overflow do parent (que poderia clipar o screenshot
          se estivesse dentro de um Card com overflow:hidden). */}
      {(fase === "preparando" || fase === "renderizando-pdf") &&
        profunda.result &&
        createPortal(
          <div ref={surfaceRef} aria-hidden>
            <PdfExportSurface
              property={property}
              dadosItbi={dados.itbi}
              dadosEstimativaIa={dados.estimativaIa}
              profundaResult={profunda.result}
            />
            {/* Marcador inerte só pra ícone — ajuda a localizar o
                portal no DevTools se precisar inspecionar. */}
            <span style={{ display: "none" }}>
              <FileText />
            </span>
          </div>,
          document.body,
        )}
    </>
  );
}
