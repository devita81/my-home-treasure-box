// Surface off-screen renderizada SÓ pra capturar o gráfico ITBI via
// html2canvas. Todo o resto do PDF agora é renderizado nativo pelo
// jsPDF — texto selecionável, bordas perfeitas, page-breaks sempre
// nas fronteiras de bloco (v33).
//
// Por que ainda existe um surface: o gráfico é Recharts (SVG). Não
// vale o esforço de reescrever em primitives jsPDF — capturar é
// barato. Mantemos um surface MÍNIMO só com o gráfico, off-screen
// (-99999px) com largura fixa pra render determinístico.

import { useMemo } from "react";
import { GraficoItbi } from "../graficos/GraficoItbi";
import { extractBandasIa } from "../graficos/bandas-ia";
import type { DadosFonte } from "../dados/tipos";

interface PdfExportSurfaceProps {
  /** Pontos ITBI (vão pro gráfico). */
  dadosItbi: DadosFonte;
  /** Estimativa IA — só pra extrair bandas sobrepostas. */
  dadosEstimativaIa: DadosFonte;
}

const SURFACE_WIDTH_PX = 720;
const CHART_HEIGHT_PX = 320;

export function PdfExportSurface({
  dadosItbi,
  dadosEstimativaIa,
}: PdfExportSurfaceProps) {
  const bandasIa = useMemo(
    () => extractBandasIa(dadosEstimativaIa.pontos),
    [dadosEstimativaIa.pontos],
  );

  // Se não tem dado ITBI, não renderiza nada — caller também não vai
  // capturar (chart fica omitido do PDF).
  if (dadosItbi.pontos.length === 0) return null;

  return (
    <div
      data-pdf-surface
      style={{
        position: "fixed",
        top: 0,
        left: -99999,
        width: `${SURFACE_WIDTH_PX}px`,
        backgroundColor: "#ffffff",
        padding: "16px",
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial",
      }}
    >
      <div
        data-pdf-chart
        style={{
          width: "100%",
          height: `${CHART_HEIGHT_PX}px`,
          backgroundColor: "#ffffff",
        }}
      >
        <GraficoItbi pontos={dadosItbi.pontos} bandasIa={bandasIa} />
      </div>
    </div>
  );
}
