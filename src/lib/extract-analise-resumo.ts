// Extrai os números estruturados do "## 1. Resumo executivo" do
// markdown da Análise profunda. O system prompt do Worker manda o
// modelo escrever nesse formato fixo:
//
//   ## 1. Resumo executivo
//   - Faixa estimada de VENDA: R$ X a R$ Y (mediana R$ Z)
//   - Faixa estimada de ALUGUEL: R$ X a R$ Y por mês (mediana R$ Z)
//   - Yield bruto estimado: X% a.a.
//   - Confiança da estimativa: alta / média / baixa (justifique)
//
// Modelos LLM variam um pouco a formatação (R$ 1,8 milhões vs
// R$ 1.800.000 vs R$ 1.8M), então usamos regex flexíveis com
// parsing robusto de moeda BR (parseBRLValue). Falhas voltam null
// na chave correspondente — o card de PDF mostra só o que conseguir
// extrair.

export interface ResumoVendaAluguel {
  /** Mínimo da faixa em BRL absoluto (ex: 1800000). null se não extraído. */
  min: number | null;
  /** Mediana / "preço médio" — termo do usuário. */
  median: number | null;
  /** Máximo da faixa. */
  max: number | null;
}

export interface ResumoExecutivo {
  venda: ResumoVendaAluguel;
  aluguel: ResumoVendaAluguel;
  /** Yield bruto estimado em %. Ex: 5.2 (significa 5,2% a.a.). */
  yieldBrutoPct: number | null;
  /** "alta" | "média" | "baixa" — null se não extraído. */
  confianca: "alta" | "média" | "baixa" | null;
}

/** Resumo todo null — usado como fallback quando nada é extraído. */
const EMPTY_RESUMO: ResumoExecutivo = {
  venda: { min: null, median: null, max: null },
  aluguel: { min: null, median: null, max: null },
  yieldBrutoPct: null,
  confianca: null,
};

/**
 * Extrai o resumo executivo do markdown da Análise profunda.
 * Sempre retorna um objeto — campos não extraídos vêm null.
 */
export function extractAnaliseResumo(markdown: string): ResumoExecutivo {
  if (!markdown || typeof markdown !== "string") return EMPTY_RESUMO;

  // Isola só a seção 1 ("Resumo executivo") pra evitar matches em
  // outras partes do relatório (cenários, recomendações também têm
  // R$). Captura do ## 1 até o próximo ## (não-greedy).
  const secaoMatch = markdown.match(
    /##\s*1\.[^\n]*\n([\s\S]*?)(?=\n##\s|\n#\s|$)/i,
  );
  const secao = secaoMatch ? secaoMatch[1] : markdown; // fallback: tenta tudo

  return {
    venda: extractFaixa(secao, "venda"),
    aluguel: extractFaixa(secao, "aluguel"),
    yieldBrutoPct: extractYield(secao),
    confianca: extractConfianca(secao),
  };
}

/**
 * Extrai faixa de uma seção. Tenta padrões em ordem:
 *   "R$ X a R$ Y (mediana R$ Z)"
 *   "R$ X – R$ Y (mediana R$ Z)"
 *   "entre R$ X e R$ Y, mediana R$ Z"
 *   "R$ X" (só um valor — vira mediana)
 *
 * Tipo determina a linha-âncora: "venda" ou "aluguel" (ou "Aluguel").
 */
function extractFaixa(
  texto: string,
  tipo: "venda" | "aluguel",
): ResumoVendaAluguel {
  // Linha-âncora: bullet que contém VENDA/ALUGUEL (case-insensitive)
  const linhaRegex =
    tipo === "venda"
      ? /(?:^|\n)\s*[-*•]\s*[^\n]*?venda[^\n]*/i
      : /(?:^|\n)\s*[-*•]\s*[^\n]*?aluguel[^\n]*/i;
  const m = texto.match(linhaRegex);
  if (!m) return { min: null, median: null, max: null };
  const linha = m[0];

  // Padrão 1: "X a Y" ou "X até Y" ou "X – Y" ou "X-Y"
  const faixaMatch = linha.match(
    /(R\$\s*[\d.,]+(?:\s*(?:mil|milh[ãa]o|milh[õo]es|mi|M|k))?)\s*(?:a|at[ée]|–|—|-)\s*(R\$\s*[\d.,]+(?:\s*(?:mil|milh[ãa]o|milh[õo]es|mi|M|k))?)/i,
  );
  let min: number | null = null;
  let max: number | null = null;
  if (faixaMatch) {
    min = parseBRLValue(faixaMatch[1]);
    max = parseBRLValue(faixaMatch[2]);
  }

  // Mediana: "(mediana R$ Z)" ou "mediana de R$ Z" ou "média R$ Z"
  const medianaMatch = linha.match(
    /(?:mediana|m[ée]dia|valor m[ée]dio)\s*(?:de\s*)?:?\s*(R\$\s*[\d.,]+(?:\s*(?:mil|milh[ãa]o|milh[õo]es|mi|M|k))?)/i,
  );
  let median: number | null = medianaMatch ? parseBRLValue(medianaMatch[1]) : null;

  // Se não pegou mediana mas pegou faixa, deriva média aritmética
  if (median == null && min != null && max != null) {
    median = (min + max) / 2;
  }

  // Se não pegou nem faixa nem mediana, tenta pegar QUALQUER valor R$
  // na linha (caso o modelo escreveu "Aluguel: R$ 5.000/mês")
  if (min == null && max == null && median == null) {
    const valMatch = linha.match(
      /R\$\s*[\d.,]+(?:\s*(?:mil|milh[ãa]o|milh[õo]es|mi|M|k))?/i,
    );
    if (valMatch) median = parseBRLValue(valMatch[0]);
  }

  return { min, median, max };
}

function extractYield(texto: string): number | null {
  // "Yield bruto estimado: 5,2% a.a." → 5.2
  const m = texto.match(/yield[^:\n]*:\s*([\d.,]+)\s*%/i);
  if (!m) return null;
  return parseFloat(m[1].replace(",", "."));
}

function extractConfianca(texto: string): ResumoExecutivo["confianca"] {
  const m = texto.match(
    /confian[çc]a[^:\n]*:\s*(alta|m[ée]dia|baixa)/i,
  );
  if (!m) return null;
  const nivel = m[1].toLowerCase();
  if (nivel.startsWith("alta")) return "alta";
  if (nivel.startsWith("baixa")) return "baixa";
  return "média";
}

/**
 * Parser de moeda BR. Aceita:
 *   "R$ 1.800.000"      → 1800000
 *   "R$ 1.800.000,50"   → 1800000.5
 *   "R$ 1,8 milhões"    → 1800000
 *   "R$ 1.8 mi"         → 1800000
 *   "R$ 800 mil"        → 800000
 *   "R$ 5.500/mês"      → 5500  (slash/sufixo ignorado)
 *
 * Heurística pra distinguir separador decimal vs milhar:
 *   • Se tem vírgula seguida de 1-2 dígitos no final, é decimal BR:
 *     "1.800.000,50" → ponto = milhar, vírgula = decimal.
 *   • Se só tem ponto, e o ponto está seguido de 3+ dígitos, é milhar
 *     EUA: "1.800.000" → ponto = milhar.
 *   • Se só tem ponto e está seguido de 1-2 dígitos, é decimal EUA:
 *     "1.8" → ponto = decimal (raro em PT-BR mas modelos LLM fazem).
 */
export function parseBRLValue(input: string): number | null {
  if (!input) return null;
  const cleaned = input.replace(/R\$\s*/i, "").trim();

  // Detecta sufixo de magnitude
  let multiplier = 1;
  let numericPart = cleaned;
  const sufixoRegex =
    /\s*(mil|milh[ãa]o|milh[õo]es|mi|M|k)\s*(?:\/m[ê e]s)?$/i;
  const sufixoMatch = cleaned.match(sufixoRegex);
  if (sufixoMatch) {
    const sufixo = sufixoMatch[1].toLowerCase();
    if (sufixo === "mil" || sufixo === "k") multiplier = 1_000;
    else multiplier = 1_000_000; // milhão/milhões/mi/M
    numericPart = cleaned.replace(sufixoRegex, "").trim();
  }

  // Remove caracteres não-numéricos exceto . e ,
  numericPart = numericPart.replace(/[^\d.,]/g, "");
  if (!numericPart) return null;

  // Detecta formato BR (vírgula decimal) vs EUA (ponto decimal)
  const hasComma = numericPart.includes(",");
  const hasDot = numericPart.includes(".");

  let normalized: string;
  if (hasComma && hasDot) {
    // BR: ponto = milhar, vírgula = decimal. "1.800.000,50"
    normalized = numericPart.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    // Só vírgula: pode ser decimal BR ou separador milhar (raro).
    // Se tem 3 dígitos depois da vírgula, é milhar; senão decimal.
    const partes = numericPart.split(",");
    if (partes[1] && partes[1].length === 3) {
      normalized = numericPart.replace(/,/g, "");
    } else {
      normalized = numericPart.replace(",", ".");
    }
  } else if (hasDot) {
    // Só ponto: distingue por número de dígitos depois do último ponto
    const lastDot = numericPart.lastIndexOf(".");
    const afterLastDot = numericPart.length - lastDot - 1;
    if (afterLastDot === 3 || numericPart.split(".").length > 2) {
      // 3 dígitos depois = milhar EUA. Ou múltiplos pontos = milhar BR.
      normalized = numericPart.replace(/\./g, "");
    } else {
      // 1-2 dígitos depois = decimal
      normalized = numericPart;
    }
  } else {
    normalized = numericPart;
  }

  const value = parseFloat(normalized);
  if (!isFinite(value) || value <= 0) return null;
  return value * multiplier;
}
