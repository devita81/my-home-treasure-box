// Parser minimalista que converte o markdown da Análise profunda em
// blocos tipados, prontos pra serem renderizados nativos pelo jsPDF.
//
// Escopo: cobre 95% do que o system prompt do Worker produz —
// headings (## / ###), parágrafos, listas (- bullet / 1. ordenado),
// negrito (**), links ([txt](url)). NÃO suporta:
//   • tabelas markdown — o prompt v29 pede listas no lugar
//   • imagens
//   • blockquote / código
//   • headings nivel 1 (#) — o prompt começa em ## 1.
//
// Por que não usar `marked` ou `markdown-it`: o output é estruturado e
// conhecido (system prompt manda formato), parsers genéricos seriam
// overkill (+50-100KB) e ainda exigiriam adapter pro nosso shape de
// bloco. Esse parser de ~120 linhas faz o trabalho.

export type InlineSpan =
  | { type: "text"; value: string }
  | { type: "bold"; value: string }
  | { type: "link"; text: string; url: string };

export type Block =
  | { type: "heading"; level: 2 | 3; spans: InlineSpan[] }
  | { type: "paragraph"; spans: InlineSpan[] }
  | { type: "list"; ordered: boolean; items: InlineSpan[][] }
  | { type: "blank" };

/**
 * Converte markdown em sequência de blocos. Trata input vazio
 * graciosamente (retorna []). Linhas em branco viram blocos `blank`
 * que o renderer usa pra espaçamento vertical.
 */
export function parseMarkdownToBlocks(markdown: string): Block[] {
  if (!markdown || typeof markdown !== "string") return [];

  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Linha em branco → bloco blank (espaçamento)
    if (!trimmed) {
      blocks.push({ type: "blank" });
      i += 1;
      continue;
    }

    // Heading: ## ou ###
    const headingMatch = trimmed.match(/^(#{2,3})\s+(.+)$/);
    if (headingMatch) {
      const level = (headingMatch[1].length as 2 | 3);
      blocks.push({
        type: "heading",
        level,
        spans: parseInlineSpans(headingMatch[2]),
      });
      i += 1;
      continue;
    }

    // Lista (bullet ou ordenada) — agrupa linhas consecutivas
    const bulletMatch = trimmed.match(/^[-*•]\s+(.*)$/);
    const orderedMatch = trimmed.match(/^\d+[.)]\s+(.*)$/);
    if (bulletMatch || orderedMatch) {
      const ordered = !!orderedMatch;
      const items: InlineSpan[][] = [];
      while (i < lines.length) {
        const cur = lines[i].trim();
        const b = cur.match(/^[-*•]\s+(.*)$/);
        const o = cur.match(/^\d+[.)]\s+(.*)$/);
        const m = ordered ? o : b;
        if (!m) break;
        items.push(parseInlineSpans(m[1]));
        i += 1;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    // Parágrafo: agrupa linhas consecutivas que não são heading nem
    // lista (concatenando como soft-break com espaço).
    const paragraphLines: string[] = [];
    while (i < lines.length) {
      const cur = lines[i].trim();
      if (!cur) break;
      if (/^#{2,3}\s/.test(cur)) break;
      if (/^[-*•]\s/.test(cur)) break;
      if (/^\d+[.)]\s/.test(cur)) break;
      paragraphLines.push(cur);
      i += 1;
    }
    if (paragraphLines.length > 0) {
      blocks.push({
        type: "paragraph",
        spans: parseInlineSpans(paragraphLines.join(" ")),
      });
    }
  }

  return blocks;
}

/**
 * Parser inline: converte uma linha de texto em spans (text, bold,
 * link). Ordem de prioridade: link > bold > text. Detalhe: stripa o
 * marker do bold (**texto**) — quem renderiza só vê o miolo.
 *
 * Não cobre: itálico (*x* ou _x_), code inline (`x`), strikethrough.
 * Se o modelo gerar, o token marker aparece como texto cru. Aceitável.
 */
export function parseInlineSpans(text: string): InlineSpan[] {
  if (!text) return [];

  const spans: InlineSpan[] = [];
  // Regex que captura link OU bold OU resto.
  // \[(.*?)\]\((.*?)\) → link [texto](url)
  // \*\*(.+?)\*\*      → bold
  const re = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*/g;
  let lastIdx = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIdx) {
      spans.push({ type: "text", value: text.slice(lastIdx, m.index) });
    }
    if (m[1] !== undefined && m[2] !== undefined) {
      spans.push({ type: "link", text: m[1], url: m[2] });
    } else if (m[3] !== undefined) {
      spans.push({ type: "bold", value: m[3] });
    }
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < text.length) {
    spans.push({ type: "text", value: text.slice(lastIdx) });
  }
  return spans;
}

/**
 * Helper: extrai o texto puro de um array de spans. Útil pra fallback
 * quando não dá pra renderizar inline (ex: link em PDF vira texto +
 * URL entre parênteses).
 */
export function spansToPlainText(spans: InlineSpan[]): string {
  return spans
    .map((s) => {
      if (s.type === "text") return s.value;
      if (s.type === "bold") return s.value;
      if (s.type === "link") return s.text;
      return "";
    })
    .join("");
}
