// Exportador PDF da Análise de preço — modo NATIVO.
//
// Histórico:
//   v32: html2canvas captura surface inteiro → JPEG → multi-page. PDF
//        ficava sem bordas claras (compressão JPEG) e com page-breaks
//        feios (cortava no meio de seções).
//   v33 (este): jsPDF render nativo seção por seção. Texto selecionável,
//        bordas perfeitas, page-breaks SEMPRE nas fronteiras de bloco
//        (heading nunca fica órfão no fim da página).
//
// Chart é a única coisa que continua via screenshot (off-screen +
// html2canvas) porque é SVG do Recharts e renderizar em jsPDF nativo
// seria reescrever a lib de gráficos.
//
// Layout: A4 portrait, margens 15mm sides, 15mm top, 18mm bottom.
// Footer com "Página N de M" + "Análise de preço".

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";
import type { Property } from "@/types/property";
import type { DadosFonte, PontoPreco } from "@/components/analise-preco/dados/tipos";
import type { PersistedResearch } from "@/components/analise-preco/dados/useAnaliseProfunda";
import { fmtBRLCompact, fmtDate } from "@/lib/format";
import { parseMarkdownToBlocks, type Block, type InlineSpan } from "./markdown-to-blocks";
import {
  extractAnaliseResumo,
  type ResumoExecutivo,
} from "./extract-analise-resumo";

export interface BuildAnalisePdfInput {
  property: Property;
  dadosItbi: DadosFonte;
  profundaResult: PersistedResearch;
  /** Elemento DOM do gráfico ITBI off-screen pra capturar via html2canvas. Opcional. */
  chartElement?: HTMLElement | null;
}

export interface BuildAnalisePdfOutput {
  blob: Blob;
  pageCount: number;
}

// ─── Constants ──────────────────────────────────────────────────────

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN_L = 15;
const MARGIN_R = 15;
const MARGIN_T = 15;
const MARGIN_B = 18;
const CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R;
const CONTENT_BOTTOM = PAGE_H - MARGIN_B;

// Paleta — alinhada com tokens do app (--primary roxo 283 80% 28%)
const COLOR_PRIMARY: [number, number, number] = [79, 29, 140];
const COLOR_TEXT: [number, number, number] = [10, 10, 10];
const COLOR_MUTED: [number, number, number] = [113, 113, 122];
const COLOR_BORDER: [number, number, number] = [212, 212, 216];
const COLOR_ITBI: [number, number, number] = [29, 78, 216];
const COLOR_PROFUNDA: [number, number, number] = [79, 29, 140]; // mesmo roxo

// Tamanhos de fonte
const FS_TITLE = 18;
const FS_SECTION = 12;
const FS_BODY = 9.5;
const FS_SMALL = 8;
const FS_CARD_TITLE = 9;
const FS_CARD_LABEL = 8;
const FS_CARD_VALUE = 11;
const FS_CARD_VALUE_DESTAQUE = 14;

// ─── Helpers ────────────────────────────────────────────────────────

/** Garante espaço vertical; se não couber, addPage. Retorna y novo. */
function ensureSpace(pdf: jsPDF, y: number, requiredH: number): number {
  if (y + requiredH > CONTENT_BOTTOM) {
    pdf.addPage();
    return MARGIN_T;
  }
  return y;
}

function setColor(pdf: jsPDF, rgb: [number, number, number]) {
  pdf.setTextColor(rgb[0], rgb[1], rgb[2]);
}
function setFill(pdf: jsPDF, rgb: [number, number, number]) {
  pdf.setFillColor(rgb[0], rgb[1], rgb[2]);
}
function setStroke(pdf: jsPDF, rgb: [number, number, number]) {
  pdf.setDrawColor(rgb[0], rgb[1], rgb[2]);
}

// ─── Section drawers ────────────────────────────────────────────────

/**
 * Desenha o header do relatório no topo da página atual. Sempre na
 * primeira página. Retorna y após o header.
 */
function drawReportHeader(
  pdf: jsPDF,
  property: Property,
  startY: number,
): number {
  let y = startY;

  // Linha de marca em cima (roxo)
  setFill(pdf, COLOR_PRIMARY);
  pdf.rect(MARGIN_L, y, CONTENT_W, 1.2, "F");
  y += 4;

  // Eyebrow
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  setColor(pdf, COLOR_PRIMARY);
  pdf.text("ANÁLISE DE PREÇO", MARGIN_L, y);
  y += 5;

  // Endereço principal
  const enderecoLinha = [
    property.rua,
    property.numero ? `nº ${property.numero}` : null,
    property.apartamento ? `apto ${property.apartamento}` : null,
  ]
    .filter(Boolean)
    .join(", ") || "Imóvel";
  const localidade = [
    property.bairro,
    property.cidade,
    property.estado,
  ]
    .filter(Boolean)
    .join(" · ");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(FS_TITLE);
  setColor(pdf, COLOR_TEXT);
  pdf.text(enderecoLinha, MARGIN_L, y);
  y += 6.5;

  if (localidade) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    setColor(pdf, COLOR_MUTED);
    pdf.text(localidade, MARGIN_L, y);
    y += 4.5;
  }

  // Ficha técnica
  const ficha = [
    property.tipo_imovel,
    property.metragem ? `${property.metragem} m² úteis` : null,
    property.area_total ? `${property.area_total} m² totais` : null,
    property.quartos
      ? `${property.quartos} ${property.quartos === 1 ? "quarto" : "quartos"}`
      : null,
    property.suites ? `${property.suites} suíte${property.suites > 1 ? "s" : ""}` : null,
    property.banheiros
      ? `${property.banheiros} banheiro${property.banheiros > 1 ? "s" : ""}`
      : null,
    property.garagens
      ? `${property.garagens} vaga${property.garagens > 1 ? "s" : ""}`
      : null,
    property.ano_construcao ? `${property.ano_construcao}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  if (ficha) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(FS_BODY);
    setColor(pdf, COLOR_TEXT);
    const linhas = pdf.splitTextToSize(ficha, CONTENT_W);
    pdf.text(linhas, MARGIN_L, y);
    y += linhas.length * 4.5;
  }

  // Timestamp
  const geradoEm = new Date().toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  pdf.setFontSize(FS_SMALL);
  setColor(pdf, COLOR_MUTED);
  pdf.text(`Gerado em ${geradoEm}`, MARGIN_L, y + 1);
  y += 7;

  return y;
}

/**
 * Section title com borda inferior. Sempre tenta caber junto com
 * algum conteúdo abaixo — chama ensureSpace passando uma margem maior
 * pra evitar título órfão no fim da página.
 */
function drawSectionTitle(pdf: jsPDF, y: number, title: string): number {
  y = ensureSpace(pdf, y, 20); // exige >= 20mm pra título + algo embaixo
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(FS_SECTION);
  setColor(pdf, COLOR_TEXT);
  pdf.text(title, MARGIN_L, y);
  y += 1.5;
  // Linha decorativa
  setStroke(pdf, COLOR_BORDER);
  pdf.setLineWidth(0.3);
  pdf.line(MARGIN_L, y, MARGIN_L + CONTENT_W, y);
  y += 5;
  return y;
}

/**
 * Card com borda esquerda colorida + título + linhas chave-valor.
 * Retorna a altura final do card pra caller decidir avanço de y.
 */
function drawCard(
  pdf: jsPDF,
  x: number,
  y: number,
  w: number,
  opts: {
    title: string;
    subtitle: string;
    accentColor: [number, number, number];
    rows: { label: string; value: string; destaque?: boolean }[];
    emptyMessage?: string;
  },
): number {
  const padding = 4;
  const headerH = 11;
  const rowH = 5.5;
  const destaqueExtra = 1.5;
  // Calcula altura
  let h = padding + headerH;
  if (opts.rows.length > 0) {
    for (const r of opts.rows) {
      h += rowH + (r.destaque ? destaqueExtra : 0);
    }
    h += padding;
  } else {
    h += 6 + padding; // empty message
  }

  // Borda + fundo
  setFill(pdf, [255, 255, 255]);
  setStroke(pdf, COLOR_BORDER);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(x, y, w, h, 1.5, 1.5, "FD");

  // Borda esquerda colorida (4mm de largura)
  setFill(pdf, opts.accentColor);
  pdf.rect(x, y, 1.4, h, "F");

  // Título
  let cy = y + padding + 2;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(FS_CARD_TITLE);
  setColor(pdf, opts.accentColor);
  pdf.text(opts.title.toUpperCase(), x + padding + 1.5, cy);
  cy += 3.5;

  // Subtítulo
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(FS_SMALL - 0.5);
  setColor(pdf, COLOR_MUTED);
  pdf.text(opts.subtitle, x + padding + 1.5, cy);
  cy += 4.5;

  // Rows ou empty
  if (opts.rows.length === 0) {
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(FS_CARD_LABEL);
    setColor(pdf, COLOR_MUTED);
    pdf.text(opts.emptyMessage ?? "Sem dados.", x + padding + 1.5, cy + 2);
    return h;
  }

  for (const r of opts.rows) {
    // Label esquerda
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(FS_CARD_LABEL);
    setColor(pdf, COLOR_MUTED);
    pdf.text(r.label, x + padding + 1.5, cy + 2);
    // Valor direita
    pdf.setFont("helvetica", r.destaque ? "bold" : "normal");
    pdf.setFontSize(r.destaque ? FS_CARD_VALUE_DESTAQUE : FS_CARD_VALUE);
    setColor(pdf, COLOR_TEXT);
    pdf.text(r.value, x + w - padding, cy + 2, { align: "right" });
    cy += rowH + (r.destaque ? destaqueExtra : 0);
  }

  return h;
}

/** Renderiza inline spans numa linha. Aplica negrito/link conforme tipo. */
function drawInlineLine(
  pdf: jsPDF,
  spans: InlineSpan[],
  x: number,
  y: number,
  maxW: number,
  baseFontSize: number,
): { y: number; lineHeight: number } {
  // Composição de spans inline é complexa em jsPDF (não tem rich text
  // out-of-the-box). Estratégia: junta tudo em texto plain e renderiza
  // em pieces. Pra simplicidade, perdemos a distinção bold/regular
  // INLINE — mas se todo o bloco for "bold-only" (heading), o caller
  // já setou font bold antes.
  //
  // Decisão: detectamos blocos onde TODOS os spans são bold (e.g.
  // bullets do tipo "**label:** valor") e renderizamos em duas
  // pieces — uma bold + uma normal. Cobre 80% dos casos do nosso
  // markdown sem complexidade extra.

  // Caso especial 1: span único de texto → simples
  if (spans.length === 1 && spans[0].type === "text") {
    const linhas = pdf.splitTextToSize(spans[0].value, maxW);
    pdf.text(linhas, x, y);
    return { y, lineHeight: linhas.length * (baseFontSize * 0.45) };
  }

  // Caso especial 2: começa com bold seguido por texto — padrão
  // "**Endereço:** Rua X, 123". Renderiza bold + normal lado a lado.
  if (
    spans.length >= 2 &&
    spans[0].type === "bold" &&
    spans.slice(1).every((s) => s.type === "text" || s.type === "link" || s.type === "bold")
  ) {
    pdf.setFont("helvetica", "bold");
    const boldText = (spans[0] as { value: string }).value;
    pdf.text(boldText, x, y);
    const boldW = pdf.getTextWidth(boldText);

    pdf.setFont("helvetica", "normal");
    const restoText = spans
      .slice(1)
      .map((s) => {
        if (s.type === "text") return s.value;
        if (s.type === "bold") return s.value;
        if (s.type === "link") return s.text;
        return "";
      })
      .join("");
    const remainW = maxW - boldW;
    const linhas = pdf.splitTextToSize(restoText, remainW);
    pdf.text(linhas, x + boldW, y);
    return { y, lineHeight: linhas.length * (baseFontSize * 0.45) };
  }

  // Fallback: plain text concatenado, sem distinção
  const plain = spans
    .map((s) => {
      if (s.type === "text") return s.value;
      if (s.type === "bold") return s.value;
      if (s.type === "link") return `${s.text} (${s.url})`;
      return "";
    })
    .join("");
  const linhas = pdf.splitTextToSize(plain, maxW);
  pdf.text(linhas, x, y);
  return { y, lineHeight: linhas.length * (baseFontSize * 0.45) };
}

/**
 * Renderiza blocos de markdown. Cada bloco pode quebrar página
 * se não couber. Headings nunca ficam órfãos.
 */
function drawMarkdownBlocks(pdf: jsPDF, y: number, blocks: Block[]): number {
  for (const block of blocks) {
    if (block.type === "blank") {
      y += 2.5;
      continue;
    }

    if (block.type === "heading") {
      const fs = block.level === 2 ? 12 : 10.5;
      const requiredH = fs * 0.5 + 6; // espaço pro título + 1 linha embaixo
      y = ensureSpace(pdf, y, requiredH + 8);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(fs);
      setColor(pdf, COLOR_TEXT);
      const text = block.spans
        .map((s) => (s.type === "text" || s.type === "bold" ? s.value : (s as { text: string }).text))
        .join("");
      const linhas = pdf.splitTextToSize(text, CONTENT_W);
      pdf.text(linhas, MARGIN_L, y + (block.level === 2 ? 3 : 2));
      y += linhas.length * (fs * 0.45) + (block.level === 2 ? 3.5 : 2.5);

      // Linha sob H2
      if (block.level === 2) {
        setStroke(pdf, COLOR_BORDER);
        pdf.setLineWidth(0.2);
        pdf.line(MARGIN_L, y, MARGIN_L + CONTENT_W, y);
        y += 3;
      }
      continue;
    }

    if (block.type === "paragraph") {
      y = ensureSpace(pdf, y, 8);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(FS_BODY);
      setColor(pdf, COLOR_TEXT);
      const { lineHeight } = drawInlineLine(
        pdf,
        block.spans,
        MARGIN_L,
        y,
        CONTENT_W,
        FS_BODY,
      );
      y += lineHeight + 2;
      continue;
    }

    if (block.type === "list") {
      const indent = 5;
      const bulletGap = 3;
      for (let idx = 0; idx < block.items.length; idx++) {
        const item = block.items[idx];
        y = ensureSpace(pdf, y, 8);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(FS_BODY);
        setColor(pdf, COLOR_TEXT);
        // Marker
        const marker = block.ordered ? `${idx + 1}.` : "•";
        pdf.text(marker, MARGIN_L + indent, y + 3);
        // Conteúdo do item (inline spans com possível bold)
        const { lineHeight } = drawInlineLine(
          pdf,
          item,
          MARGIN_L + indent + bulletGap + 2,
          y + 3,
          CONTENT_W - indent - bulletGap - 2,
          FS_BODY,
        );
        y += Math.max(lineHeight, 4) + 1.5;
      }
      y += 1;
      continue;
    }
  }
  return y;
}

/** Footer com numeração — chamado no FINAL sobre todas as páginas. */
function drawFooters(pdf: jsPDF) {
  const pageCount = pdf.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(FS_SMALL);
    setColor(pdf, COLOR_MUTED);
    pdf.text(
      "Análise de preço",
      MARGIN_L,
      PAGE_H - 8,
    );
    pdf.text(
      `Página ${i} de ${pageCount}`,
      PAGE_W - MARGIN_R,
      PAGE_H - 8,
      { align: "right" },
    );
  }
}

// ─── Cards de Resumo ────────────────────────────────────────────────

function rowsCardItbi(dados: DadosFonte): {
  rows: { label: string; value: string; destaque?: boolean }[];
  empty?: string;
} {
  if (dados.stats.count === 0) {
    return { rows: [], empty: "Nenhuma transação ITBI encontrada." };
  }
  const rows: { label: string; value: string; destaque?: boolean }[] = [
    {
      label: "Mediana",
      value: fmtBRLCompact(dados.stats.median),
      destaque: true,
    },
  ];
  if (dados.stats.min != null && dados.stats.max != null) {
    rows.push({
      label: "Faixa",
      value: `${fmtBRLCompact(dados.stats.min)} – ${fmtBRLCompact(dados.stats.max)}`,
    });
  }
  if (dados.stats.ultimoPreco != null) {
    rows.push({
      label: "Último",
      value: dados.stats.ultimaData
        ? `${fmtBRLCompact(dados.stats.ultimoPreco)} · ${fmtDate(dados.stats.ultimaData)}`
        : fmtBRLCompact(dados.stats.ultimoPreco),
    });
  }
  return { rows };
}

function rowsCardProfunda(resumo: ResumoExecutivo): {
  rows: { label: string; value: string; destaque?: boolean }[];
  empty?: string;
} {
  const rows: { label: string; value: string; destaque?: boolean }[] = [];
  if (resumo.venda.median != null) {
    rows.push({
      label: "Preço médio venda",
      value: fmtBRLCompact(resumo.venda.median),
      destaque: true,
    });
  }
  if (resumo.venda.min != null && resumo.venda.max != null) {
    rows.push({
      label: "Faixa venda",
      value: `${fmtBRLCompact(resumo.venda.min)} – ${fmtBRLCompact(resumo.venda.max)}`,
    });
  }
  if (resumo.aluguel.median != null) {
    rows.push({
      label: "Aluguel médio",
      value: `${fmtBRLCompact(resumo.aluguel.median)}/mês`,
    });
  }
  if (resumo.yieldBrutoPct != null) {
    rows.push({
      label: "Yield bruto",
      value: `${resumo.yieldBrutoPct.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 })}% a.a.`,
    });
  }
  if (resumo.confianca) {
    const cap = resumo.confianca.charAt(0).toUpperCase() + resumo.confianca.slice(1);
    rows.push({ label: "Confiança", value: cap });
  }
  if (rows.length === 0) {
    return {
      rows: [],
      empty: "Análise profunda gerada mas resumo não extraído. Veja relatório completo abaixo.",
    };
  }
  return { rows };
}

// ─── Main ───────────────────────────────────────────────────────────

export async function buildAnalisePdf(
  input: BuildAnalisePdfInput,
): Promise<BuildAnalisePdfOutput> {
  const { property, dadosItbi, profundaResult, chartElement } = input;

  const pdf = new jsPDF({
    unit: "mm",
    format: "a4",
    orientation: "portrait",
    compress: true,
  });

  let y = MARGIN_T;

  // ─── Header ──────────────────────────────────────────────────────
  y = drawReportHeader(pdf, property, y);

  // ─── Resumo executivo: dois cards lado a lado ────────────────────
  y = drawSectionTitle(pdf, y, "Resumo executivo");

  const cardW = (CONTENT_W - 4) / 2;
  const cardItbiRows = rowsCardItbi(dadosItbi);
  const resumoProfunda = extractAnaliseResumo(profundaResult.markdown);
  const cardProfundaRows = rowsCardProfunda(resumoProfunda);

  // Pré-checa altura aproximada do maior card pra garantir que ambos
  // ficam na mesma página (não faz sentido quebrar o resumo no meio)
  y = ensureSpace(pdf, y, 65);
  const h1 = drawCard(pdf, MARGIN_L, y, cardW, {
    title: "Histórico ITBI",
    subtitle: `Prefeitura · ${dadosItbi.stats.count} ${dadosItbi.stats.count === 1 ? "venda" : "vendas"} oficiais`,
    accentColor: COLOR_ITBI,
    rows: cardItbiRows.rows,
    emptyMessage: cardItbiRows.empty,
  });
  const h2 = drawCard(pdf, MARGIN_L + cardW + 4, y, cardW, {
    title: "Análise profunda",
    subtitle: "Claude + web search",
    accentColor: COLOR_PROFUNDA,
    rows: cardProfundaRows.rows,
    emptyMessage: cardProfundaRows.empty,
  });
  y += Math.max(h1, h2) + 6;

  // ─── Gráfico (opcional, só se o caller passou chartElement) ──────
  if (chartElement) {
    try {
      const canvas = await html2canvas(chartElement, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
        foreignObjectRendering: false,
      });
      const imgData = canvas.toDataURL("image/png");
      // largura = CONTENT_W; altura proporcional
      const imgW = CONTENT_W;
      const imgH = (canvas.height * imgW) / canvas.width;
      // Garante que o chart inteiro caiba — se não, addPage
      y = drawSectionTitle(pdf, y, "Gráfico — Preço por m² (ITBI + faixa IA)");
      y = ensureSpace(pdf, y, imgH + 4);
      pdf.addImage(imgData, "PNG", MARGIN_L, y, imgW, imgH, undefined, "FAST");
      y += imgH + 6;
    } catch (e) {
      // Falha no chart não é crítica — segue sem chart
      console.warn("[buildAnalisePdf] falha capturando chart:", e);
    }
  }

  // ─── Histórico ITBI (tabela completa) ────────────────────────────
  if (dadosItbi.pontos.length > 0) {
    y = drawSectionTitle(
      pdf,
      y,
      `Histórico ITBI (${dadosItbi.pontos.length} transações)`,
    );

    const pontosOrdenados = [...dadosItbi.pontos].sort((a: PontoPreco, b: PontoPreco) => {
      const da = a.data ? new Date(a.data).getTime() : 0;
      const db = b.data ? new Date(b.data).getTime() : 0;
      return db - da;
    });

    autoTable(pdf, {
      startY: y,
      head: [["Data", "Endereço / Descrição", "Área (m²)", "Preço (R$)", "R$/m²"]],
      body: pontosOrdenados.slice(0, 60).map((p) => {
        const precoM2 = p.area && p.area > 0 ? p.preco / p.area : null;
        return [
          p.data ? fmtDate(p.data) : "—",
          [p.display.primary, p.display.secondary].filter(Boolean).join("\n"),
          p.area ? p.area.toFixed(0) : "—",
          fmtBRLCompact(p.preco),
          precoM2 ? fmtBRLCompact(precoM2) : "—",
        ];
      }),
      margin: { left: MARGIN_L, right: MARGIN_R, bottom: MARGIN_B },
      headStyles: {
        fillColor: [244, 244, 245],
        textColor: COLOR_TEXT,
        fontStyle: "bold",
        fontSize: 8.5,
        cellPadding: 2,
      },
      bodyStyles: {
        fontSize: 8.5,
        cellPadding: 2,
        textColor: COLOR_TEXT,
      },
      alternateRowStyles: {
        fillColor: [250, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: "auto" },
        2: { cellWidth: 22, halign: "right" },
        3: { cellWidth: 32, halign: "right" },
        4: { cellWidth: 26, halign: "right" },
      },
      theme: "grid",
      styles: {
        lineColor: COLOR_BORDER,
        lineWidth: 0.15,
      },
    });
    y = pdf.lastAutoTable.finalY + 4;

    if (pontosOrdenados.length > 60) {
      pdf.setFont("helvetica", "italic");
      pdf.setFontSize(FS_SMALL);
      setColor(pdf, COLOR_MUTED);
      pdf.text(
        `Mostrando as 60 transações mais recentes de ${pontosOrdenados.length} no total.`,
        MARGIN_L,
        y,
      );
      y += 5;
    }
    y += 2;
  }

  // ─── Análise profunda (markdown nativo) ──────────────────────────
  y = drawSectionTitle(pdf, y, "Análise profunda · Claude + web search");
  const blocks = parseMarkdownToBlocks(profundaResult.markdown);
  y = drawMarkdownBlocks(pdf, y, blocks);

  // ─── Fontes consultadas ──────────────────────────────────────────
  if (profundaResult.citations.length > 0) {
    y = drawSectionTitle(
      pdf,
      y,
      `Fontes consultadas (${profundaResult.citations.length})`,
    );
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(FS_SMALL);
    setColor(pdf, COLOR_TEXT);

    for (let i = 0; i < profundaResult.citations.length; i++) {
      const c = profundaResult.citations[i];
      y = ensureSpace(pdf, y, 10);
      const title = c.title || c.url;
      // Numerador
      pdf.setFont("helvetica", "bold");
      pdf.text(`${i + 1}.`, MARGIN_L, y + 2.5);
      // Título
      pdf.setFont("helvetica", "normal");
      const tituloLinhas = pdf.splitTextToSize(title, CONTENT_W - 6);
      pdf.text(tituloLinhas, MARGIN_L + 6, y + 2.5);
      y += tituloLinhas.length * 3.5;
      // URL em cinza
      if (c.title && c.title !== c.url) {
        setColor(pdf, COLOR_MUTED);
        pdf.setFontSize(FS_SMALL - 1);
        const urlLinhas = pdf.splitTextToSize(c.url, CONTENT_W - 6);
        pdf.text(urlLinhas, MARGIN_L + 6, y + 2);
        y += urlLinhas.length * 3.2;
        pdf.setFontSize(FS_SMALL);
        setColor(pdf, COLOR_TEXT);
      }
      y += 1.5;
    }
  }

  // ─── Footers com numeração ───────────────────────────────────────
  drawFooters(pdf);

  const blob = pdf.output("blob");
  return { blob, pageCount: pdf.getNumberOfPages() };
}

// ─── Filename helper ────────────────────────────────────────────────

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
  const slug = base
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase();
  const dataStr = new Date().toISOString().slice(0, 10);
  return `analise-preco-${slug}-${dataStr}.pdf`;
}
