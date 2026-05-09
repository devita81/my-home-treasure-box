// Renderizador de markdown específico do app — converte respostas
// vindas do ChatGPT (com tabelas, headings, listas, ênfases) em HTML
// estilizado para os dialogs de análise. Heurísticas de "fonte"
// (ITBI vs IA) detectam o tom da tabela e injetam um badge na
// primeira coluna.
//
// Antes vivia inline no `PropertyDetails.tsx` (~230 linhas). Foi
// extraído para que `<DialogAnaliseIa>` na nova `<AnalisePreco>`
// renderize a mesma análise sem duplicar o código.

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatInlineMarkdown = (text: string) =>
  escapeHtml(text)
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary underline underline-offset-4 hover:text-primary/80 inline-flex items-center gap-1">$1 ↗</a>',
    )
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
    .replace(
      /`([^`]+)`/g,
      '<code class="rounded bg-muted px-1.5 py-0.5 text-[12px] text-foreground">$1</code>',
    );

const isCompactMetricCell = (text: string) => {
  const value = text.trim();
  return (
    /^(R\$\s?[\d.]+(?:,\d+)?(?:\/m²|\/m2)?)$/.test(value) ||
    /^(\d+[\d.,]*\s?(?:m²|m2|%|anos?)?)$/.test(value)
  );
};

interface SourceLabel {
  label: string;
  tone: "itbi" | "ai";
}

// Resolve a "fonte" (origem dos dados) para uma linha da tabela
// com base no título da primeira coluna e no contexto global (se há ITBI).
const resolveSourceLabel = (
  rowTitlePlain: string,
  hasItbi: boolean,
): SourceLabel | null => {
  const t = rowTitlePlain.toLowerCase();
  if (!t) return null;
  if (t.includes("valor de venda")) {
    return hasItbi
      ? { label: "Fonte: ITBI Prefeitura SP (transações reais)", tone: "itbi" }
      : { label: "Fonte: Estimativa IA (comparáveis de mercado)", tone: "ai" };
  }
  if (t.includes("aluguel")) {
    return { label: "Fonte: Estimativa IA (comparáveis de mercado)", tone: "ai" };
  }
  if (t.includes("preço por m") || t.includes("preco por m")) {
    return { label: "Fonte: Estimativa IA (comparáveis de mercado)", tone: "ai" };
  }
  return null;
};

const renderSourceBadgeHtml = (src: SourceLabel) => {
  const cls =
    src.tone === "itbi"
      ? "bg-warning/15 text-warning-foreground border-warning/40"
      : "bg-primary/10 text-primary border-primary/30";
  return `<span class="mt-1 inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[12px] font-medium uppercase tracking-[0.06em] ${cls}">${src.label}</span>`;
};

const renderMarkdownTable = (tableLines: string[], hasItbi = false) => {
  const getCells = (line: string) =>
    line
      .split("|")
      .slice(1, -1)
      .map((cell) => formatInlineMarkdown(cell.trim()));
  const headers = getCells(tableLines[0]);
  const rows = tableLines
    .slice(2)
    .map(getCells)
    .filter((row) => row.some(Boolean));
  const hasNarrativeLastColumn = rows.some((row) => {
    const lastCell = row[row.length - 1]?.replace(/<[^>]+>/g, "").trim() || "";
    return lastCell.length > 28 && !isCompactMetricCell(lastCell);
  });

  // Tabelas com muitas colunas (>=6) só viram tabela em telas grandes (lg+),
  // caso contrário ficam como cards para evitar scroll horizontal no mobile/tablet.
  const isWide = headers.length >= 6;
  const desktopShowClass = isWide ? "hidden lg:block" : "hidden sm:block";
  const mobileShowClass = isWide ? "lg:hidden" : "sm:hidden";

  // ===== Desktop view: traditional table =====
  let desktop = `<div class="my-5 ${desktopShowClass} overflow-hidden rounded-xl border border-border bg-card shadow-sm"><div class="overflow-x-auto"><table class="w-full border-collapse text-[13px]`;
  desktop += hasNarrativeLastColumn ? " table-fixed" : "";
  desktop += '">';

  if (hasNarrativeLastColumn && headers.length === 4) {
    desktop +=
      '<colgroup><col style="width: 17%" /><col style="width: 15%" /><col style="width: 15%" /><col style="width: 53%" /></colgroup>';
  }

  desktop += '<thead><tr class="border-b-2 border-border bg-muted">';
  headers.forEach((header, index) => {
    const alignClass =
      index === 0 || (hasNarrativeLastColumn && index === headers.length - 1)
        ? "text-left"
        : "text-right";
    desktop += `<th class="px-3 py-2.5 text-[13px] font-bold uppercase tracking-[0.08em] text-foreground/80 ${alignClass} whitespace-nowrap">${header}</th>`;
  });
  desktop += "</tr></thead><tbody>";

  rows.forEach((row, rowIdx) => {
    const zebra = rowIdx % 2 === 1 ? "bg-muted/30" : "";
    const rowTitlePlain = (row[0] || "").replace(/<[^>]+>/g, "").trim();
    const rowSource = resolveSourceLabel(rowTitlePlain, hasItbi);
    desktop += `<tr class="border-b border-border/40 last:border-b-0 ${zebra} hover:bg-accent/40 transition-colors">`;
    row.forEach((cell, index) => {
      const plainText = cell.replace(/<[^>]+>/g, "").trim();
      const isNarrativeCell = hasNarrativeLastColumn && index === row.length - 1;
      const isMetric = isCompactMetricCell(plainText);
      const alignClass =
        index === 0 || isNarrativeCell
          ? "text-left"
          : isMetric
            ? "text-right whitespace-nowrap tabular-nums"
            : "text-left";
      const toneClass = isNarrativeCell
        ? "text-muted-foreground leading-6 break-words text-[13px]"
        : index === 0
          ? "font-semibold text-foreground whitespace-nowrap"
          : isMetric
            ? "font-semibold text-foreground"
            : "text-foreground";
      const titleSourceBadge =
        index === 0 && rowSource
          ? `<div class="mt-1 whitespace-normal">${renderSourceBadgeHtml(rowSource)}</div>`
          : "";
      desktop += `<td class="px-3 py-2.5 align-middle ${alignClass} ${toneClass}">${cell || "—"}${titleSourceBadge}</td>`;
    });
    desktop += "</tr>";
  });

  desktop += "</tbody></table></div></div>";

  // ===== Mobile/tablet view: card list =====
  let mobile = `<div class="my-4 ${mobileShowClass} space-y-2.5">`;
  rows.forEach((row) => {
    const titleCell = row[0] || "—";
    const titlePlain = titleCell.replace(/<[^>]+>/g, "").trim();
    const rowSource = resolveSourceLabel(titlePlain, hasItbi);
    mobile += '<div class="rounded-lg border border-border bg-card/80 shadow-sm p-3">';
    mobile += `<div class="text-[13px] font-semibold text-foreground mb-1 break-words">${titleCell}</div>`;
    if (rowSource) {
      mobile += `<div class="mb-2">${renderSourceBadgeHtml(rowSource)}</div>`;
    }
    mobile += '<dl class="space-y-1.5">';
    for (let i = 1; i < row.length; i++) {
      const cell = row[i] || "—";
      const plainText = cell.replace(/<[^>]+>/g, "").trim();
      const header = headers[i] || "";
      const isNarrativeCell = hasNarrativeLastColumn && i === row.length - 1;
      if (isNarrativeCell) {
        mobile += '<div class="pt-1.5 mt-1.5 border-t border-border/60">';
        if (header) {
          mobile += `<dt class="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-1">${header}</dt>`;
        }
        mobile += `<dd class="text-[12px] leading-5 text-muted-foreground break-words">${cell}</dd>`;
        mobile += "</div>";
      } else {
        const valueAlign = isCompactMetricCell(plainText) ? "tabular-nums" : "";
        mobile += '<div class="flex items-start justify-between gap-3">';
        mobile += `<dt class="text-[13px] font-medium uppercase tracking-[0.1em] text-muted-foreground shrink-0">${header}</dt>`;
        mobile += `<dd class="text-[12px] font-medium text-foreground text-right break-words min-w-0 ${valueAlign}">${cell}</dd>`;
        mobile += "</div>";
      }
    }
    mobile += "</dl></div>";
  });
  mobile += "</div>";

  return desktop + mobile;
};

/**
 * Converte um blob de markdown (vindo do GPT pela edge function
 * `search-property-info`) em HTML pronto para `dangerouslySetInnerHTML`.
 *
 * Suporta: cabeçalhos `##` / `###`, parágrafos, separadores `---`,
 * listas com `-`, ênfase `**bold**` e `` `code` ``, links
 * `[texto](url)`, e tabelas pipe-style — tabelas são rendererizadas
 * em duas variações (desktop / mobile-cards) controladas por classes
 * `hidden sm:block` / `sm:hidden`.
 *
 * Quando o blob menciona "DADOS REAIS ITBI" ou similar, a primeira
 * coluna ganha um badge dourado dizendo "Fonte: ITBI Prefeitura SP".
 */
export function convertMarkdownToHtml(markdown: string): string {
  const hasItbi =
    /DADOS REAIS ITBI|ancorad[oa] em\s+\d+\s+transaç[õo]es ITBI|transaç[õo]es ITBI tratadas/i.test(
      markdown,
    );

  const lines = markdown.split("\n");
  const blocks: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();

    if (!line) {
      index += 1;
      continue;
    }

    const nextLine = lines[index + 1]?.trim() || "";
    const isTableStart =
      line.startsWith("|") &&
      line.endsWith("|") &&
      /^\|?\s*[:\-| ]+\|?$/.test(nextLine);

    if (isTableStart) {
      const tableLines = [line, nextLine];
      index += 2;
      while (index < lines.length) {
        const current = lines[index].trim();
        if (!(current.startsWith("|") && current.endsWith("|"))) break;
        tableLines.push(current);
        index += 1;
      }
      blocks.push(renderMarkdownTable(tableLines, hasItbi));
      continue;
    }

    if (line.startsWith("## ")) {
      blocks.push(
        `<h2 class="mt-8 mb-3 border-b border-primary/30 pb-2 text-base font-bold text-foreground first:mt-0">${formatInlineMarkdown(line.slice(3))}</h2>`,
      );
      index += 1;
      continue;
    }

    if (line.startsWith("### ")) {
      blocks.push(
        `<h3 class="mt-5 mb-2 text-sm font-semibold text-foreground">${formatInlineMarkdown(line.slice(4))}</h3>`,
      );
      index += 1;
      continue;
    }

    if (line === "---") {
      blocks.push('<hr class="my-5 border-border/60" />');
      index += 1;
      continue;
    }

    if (line.startsWith("- ")) {
      const items: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith("- ")) {
        items.push(lines[index].trim().slice(2));
        index += 1;
      }
      blocks.push(
        `<ul class="my-3 space-y-2.5">${items.map((item) => `<li class="ml-5 list-disc text-sm leading-6 text-foreground">${formatInlineMarkdown(item)}</li>`).join("")}</ul>`,
      );
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const current = lines[index].trim();
      const upcoming = lines[index + 1]?.trim() || "";
      const isUpcomingTable =
        current.startsWith("|") &&
        current.endsWith("|") &&
        /^\|?\s*[:\-| ]+\|?$/.test(upcoming);
      if (
        !current ||
        current.startsWith("## ") ||
        current.startsWith("### ") ||
        current === "---" ||
        current.startsWith("- ") ||
        isUpcomingTable
      ) {
        break;
      }
      paragraphLines.push(current);
      index += 1;
    }

    if (paragraphLines.length > 0) {
      blocks.push(
        `<p class="text-sm leading-7 text-foreground">${paragraphLines.map(formatInlineMarkdown).join("<br />")}</p>`,
      );
      continue;
    }

    index += 1;
  }

  return blocks.join("");
}
