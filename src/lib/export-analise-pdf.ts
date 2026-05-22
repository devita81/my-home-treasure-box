// Pipeline html2canvas → jsPDF pra exportar a `<PdfExportSurface>`
// como PDF multi-página. Função pura — recebe o elemento já montado
// e cospe um Blob.
//
// Estratégia:
//   1. html2canvas captura o surface inteiro como um único canvas
//      grande (todas as seções empilhadas verticalmente)
//   2. Calcula a altura proporcional em mm pra caber na largura útil
//      do A4 (190mm com 10mm de margem cada lado)
//   3. Para cada página A4, adiciona a MESMA imagem deslocada
//      verticalmente — o jsPDF clipa automaticamente o que sai da
//      página. Padrão consolidado da comunidade.
//
// Por que JPEG 0.85 (não PNG): markdown + tabelas geram canvas grande
// (5-15MB em PNG); JPEG 0.85 corta pra ~500KB-1.5MB sem perda visível
// de qualidade no texto. PDF resultante fica < 3MB típico.

import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export interface BuildAnalisePdfInput {
  /** Elemento DOM já renderizado (off-screen) que será capturado. */
  surfaceElement: HTMLElement;
}

export interface BuildAnalisePdfOutput {
  blob: Blob;
  /** Pra inspeção/log — quantas páginas o PDF tem. */
  pageCount: number;
}

/** A4 em mm. */
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const MARGIN_MM = 10;
const USABLE_WIDTH_MM = A4_WIDTH_MM - MARGIN_MM * 2;
const USABLE_HEIGHT_MM = A4_HEIGHT_MM - MARGIN_MM * 2;

export async function buildAnalisePdf({
  surfaceElement,
}: BuildAnalisePdfInput): Promise<BuildAnalisePdfOutput> {
  // Captura o surface. Scale 2 melhora nitidez sem explodir o PDF.
  // `useCORS: true` permite carregar imagens externas (citations com
  // favicon etc); `backgroundColor: #ffffff` garante fundo branco
  // mesmo se o body tiver classe dark mode.
  const canvas = await html2canvas(surfaceElement, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
    // Desabilita o screenshot do que está fora da viewport — o surface
    // está em fixed -99999px, fora da viewport. Capture só o elemento.
    foreignObjectRendering: false,
  });

  // Converte pra JPEG (mais leve que PNG pra fotos/imagens), 85%.
  const imgData = canvas.toDataURL("image/jpeg", 0.85);

  // Calcula altura proporcional em mm
  const imgWidthMm = USABLE_WIDTH_MM;
  const imgHeightMm = (canvas.height * imgWidthMm) / canvas.width;

  const pdf = new jsPDF({
    unit: "mm",
    format: "a4",
    orientation: "portrait",
    // compress: true reduz mais o tamanho final
    compress: true,
  });

  // Multi-page slice. A trick clássica: usa a MESMA imagem em cada
  // página, mas com `y` negativo crescente — jsPDF clipa o que sai
  // da página. Resultado: cada página mostra uma fatia diferente da
  // imagem total.
  let heightRemainingMm = imgHeightMm;
  let yPosition = MARGIN_MM;

  // Primeira página
  pdf.addImage(
    imgData,
    "JPEG",
    MARGIN_MM,
    yPosition,
    imgWidthMm,
    imgHeightMm,
    undefined,
    "FAST", // alias compression — mais rápido pra imagens grandes
  );
  heightRemainingMm -= USABLE_HEIGHT_MM;

  let pageCount = 1;
  while (heightRemainingMm > 0) {
    pdf.addPage();
    pageCount += 1;
    // Deslocar a imagem pra cima de (página_anterior * usableHeight)
    yPosition -= USABLE_HEIGHT_MM;
    pdf.addImage(
      imgData,
      "JPEG",
      MARGIN_MM,
      yPosition,
      imgWidthMm,
      imgHeightMm,
      undefined,
      "FAST",
    );
    heightRemainingMm -= USABLE_HEIGHT_MM;
  }

  const blob = pdf.output("blob");
  return { blob, pageCount };
}

/**
 * Helper pra montar o filename a partir do imóvel. Tira acentos e
 * caracteres especiais — o `pdf-delivery.normalizePdfFileName` faz
 * uma segunda passada mais conservadora, mas é bom já começar limpo.
 */
export function buildPdfFileName(opts: {
  rua?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
}): string {
  const partes = [opts.rua, opts.numero, opts.bairro, opts.cidade]
    .filter(Boolean)
    .map((s) => (s as string).trim())
    .filter((s) => s.length > 0);
  const base = partes.length > 0 ? partes.join(" - ") : "analise-preco";
  // Remove acentos via NFD + strip combining marks; colapsa whitespace
  const slug = base
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase();
  const dataStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return `analise-preco-${slug}-${dataStr}.pdf`;
}
