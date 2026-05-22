// Surface off-screen renderizada SÓ durante a exportação do PDF.
// É montada/desmontada pelo `BotaoExportarPdf` conforme demanda.
//
// Por que off-screen em vez de capturar a UI viva:
//   • Layout fixo (largura 800px) e tamanho determinístico — o PDF
//     não depende da viewport atual do usuário.
//   • Conteúdo controlado: exclui ZAP/Anúncios ativos por decisão de
//     produto (v32). Aparece SÓ o que faz sentido num relatório
//     técnico imprimível: header, cards ITBI + IA, gráfico ITBI com
//     bandas IA sobrepostas, tabela de transações ITBI, relatório
//     completo da Análise profunda, fontes consultadas.
//   • Estilos print-friendly (fundo branco, texto preto, sem gradient
//     escuro) sem afetar a UI viva.
//
// Como funciona:
//   1. O `BotaoExportarPdf` setExporting(true)
//   2. Esse componente é renderizado posicionado a -9999px da viewport
//      (off-screen mas no DOM — html2canvas consegue capturar)
//   3. Pequeno delay (~500ms) pra Recharts terminar animações
//   4. html2canvas tira screenshot da div inteira
//   5. Imagem é fatiada em páginas A4 e adicionada ao jsPDF
//   6. setExporting(false) — surface é desmontada

import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { GraficoItbi } from "../graficos/GraficoItbi";
import { extractBandasIa } from "../graficos/bandas-ia";
import { fmtBRLCompact, fmtDate } from "@/lib/format";
import type { Property } from "@/types/property";
import type { DadosFonte } from "../dados/tipos";
import type { PersistedResearch } from "../dados/useAnaliseProfunda";

interface PdfExportSurfaceProps {
  property: Property;
  /** Dados ITBI (pra cards + tabela + gráfico). */
  dadosItbi: DadosFonte;
  /** Dados Estimativa IA (pra cards + bandas no gráfico). */
  dadosEstimativaIa: DadosFonte;
  /** Resultado da Análise profunda. Já garantido !== null pelo botão. */
  profundaResult: PersistedResearch;
}

/**
 * Largura fixa em px — todo o layout interno escala a partir daqui.
 * 800px é confortável pra A4 (que tem ~595pt = ~793px a 96 DPI), com
 * margens internas no PDF reduzindo pra ~190mm de área útil.
 */
const SURFACE_WIDTH_PX = 800;

export function PdfExportSurface({
  property,
  dadosItbi,
  dadosEstimativaIa,
  profundaResult,
}: PdfExportSurfaceProps) {
  const bandasIa = useMemo(
    () => extractBandasIa(dadosEstimativaIa.pontos),
    [dadosEstimativaIa.pontos],
  );

  const enderecoLinha = [
    property.rua,
    property.numero ? `nº ${property.numero}` : null,
    property.apartamento ? `apto ${property.apartamento}` : null,
    property.bairro,
    `${property.cidade ?? ""}${property.estado ? "/" + property.estado : ""}`,
  ]
    .filter(Boolean)
    .join(", ");

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
    property.ano_construcao ? `construído em ${property.ano_construcao}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const geradoEm = new Date().toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Pontos ITBI ordenados por data (mais recente primeiro) pra tabela
  const pontosItbiOrdenados = useMemo(() => {
    return [...dadosItbi.pontos].sort((a, b) => {
      const da = a.data ? new Date(a.data).getTime() : 0;
      const db = b.data ? new Date(b.data).getTime() : 0;
      return db - da;
    });
  }, [dadosItbi.pontos]);

  return (
    <div
      data-pdf-surface
      style={{
        position: "fixed",
        top: 0,
        left: -99999,
        width: `${SURFACE_WIDTH_PX}px`,
        backgroundColor: "#ffffff",
        color: "#0a0a0a",
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial",
        padding: "32px",
        fontSize: "13px",
        lineHeight: 1.55,
      }}
    >
      {/* ─── Cabeçalho do relatório ─────────────────────────────── */}
      <header
        style={{
          borderBottom: "3px solid #4f1d8c",
          paddingBottom: "14px",
          marginBottom: "20px",
        }}
      >
        <p
          style={{
            fontSize: "11px",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "#4f1d8c",
            margin: 0,
            fontWeight: 600,
          }}
        >
          My Home Collection · Análise de preço
        </p>
        <h1
          style={{
            fontSize: "24px",
            fontWeight: 700,
            margin: "6px 0 4px",
            color: "#0a0a0a",
          }}
        >
          {enderecoLinha || "Imóvel"}
        </h1>
        {ficha ? (
          <p style={{ fontSize: "13px", color: "#3f3f46", margin: 0 }}>
            {ficha}
          </p>
        ) : null}
        <p
          style={{
            fontSize: "11px",
            color: "#71717a",
            marginTop: "8px",
            marginBottom: 0,
          }}
        >
          Gerado em {geradoEm}
        </p>
      </header>

      {/* ─── Resumo executivo: cards de preço ──────────────────── */}
      <h2 style={sectionTitleStyle}>Resumo executivo</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        <CardPdf
          titulo="Histórico ITBI"
          subtitulo="Prefeitura · Vendas oficiais"
          dados={dadosItbi}
          accentColor="#1d4ed8"
        />
        <CardPdf
          titulo="Estimativa IA"
          subtitulo="ChatGPT · Single-shot"
          dados={dadosEstimativaIa}
          accentColor="#15803d"
        />
      </div>

      {/* ─── Gráfico ITBI ────────────────────────────────────────
          Re-renderiza GraficoItbi com largura fixa. Recharts entende
          o container e desenha em SVG. O BotaoExportarPdf espera
          ~500ms antes do html2canvas pra animações terminarem. */}
      {dadosItbi.pontos.length > 0 ? (
        <>
          <h2 style={sectionTitleStyle}>
            Gráfico — Preço por m² (ITBI + faixa IA)
          </h2>
          <div
            style={{
              width: "100%",
              height: "320px",
              padding: "8px",
              border: "1px solid #e4e4e7",
              borderRadius: "8px",
              marginBottom: "20px",
              backgroundColor: "#ffffff",
            }}
          >
            <GraficoItbi
              pontos={dadosItbi.pontos}
              bandasIa={bandasIa}
            />
          </div>
        </>
      ) : null}

      {/* ─── Histórico ITBI (tabela) ──────────────────────────── */}
      {pontosItbiOrdenados.length > 0 ? (
        <>
          <h2 style={sectionTitleStyle}>
            Histórico ITBI ({pontosItbiOrdenados.length} transações)
          </h2>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              marginBottom: "24px",
              fontSize: "12px",
            }}
          >
            <thead>
              <tr style={{ backgroundColor: "#f4f4f5" }}>
                <th style={thStyle}>Data</th>
                <th style={thStyle}>Endereço / Descrição</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Área (m²)</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Preço (R$)</th>
                <th style={{ ...thStyle, textAlign: "right" }}>R$/m²</th>
              </tr>
            </thead>
            <tbody>
              {pontosItbiOrdenados.slice(0, 40).map((p) => {
                const precoM2 =
                  p.area && p.area > 0 ? p.preco / p.area : null;
                return (
                  <tr key={p.id} style={{ borderTop: "1px solid #e4e4e7" }}>
                    <td style={tdStyle}>
                      {p.data ? fmtDate(p.data) : "—"}
                    </td>
                    <td style={tdStyle}>
                      <div>{p.display.primary}</div>
                      {p.display.secondary ? (
                        <div style={{ color: "#71717a", fontSize: "11px" }}>
                          {p.display.secondary}
                        </div>
                      ) : null}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      {p.area ? p.area.toFixed(0) : "—"}
                    </td>
                    <td
                      style={{
                        ...tdStyle,
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {fmtBRLCompact(p.preco)}
                    </td>
                    <td
                      style={{
                        ...tdStyle,
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {precoM2 ? fmtBRLCompact(precoM2) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {pontosItbiOrdenados.length > 40 ? (
            <p
              style={{
                fontSize: "11px",
                color: "#71717a",
                marginTop: "-16px",
                marginBottom: "20px",
                fontStyle: "italic",
              }}
            >
              Mostrando as 40 transações mais recentes de{" "}
              {pontosItbiOrdenados.length} no total.
            </p>
          ) : null}
        </>
      ) : null}

      {/* ─── Análise profunda ──────────────────────────────────── */}
      <h2 style={sectionTitleStyle}>Análise profunda (Claude + web)</h2>
      <div
        style={{
          backgroundColor: "#fafafa",
          border: "1px solid #e4e4e7",
          borderRadius: "8px",
          padding: "16px",
          marginBottom: "20px",
        }}
        className="
          [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-foreground
          [&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold
          [&_p]:my-2 [&_p]:text-[13px]
          [&_ul]:my-2 [&_ul]:pl-5 [&_ul]:list-disc [&_ul]:space-y-1
          [&_ol]:my-2 [&_ol]:pl-5 [&_ol]:list-decimal [&_ol]:space-y-1
          [&_li]:pl-1 [&_li]:text-[13px]
          [&_strong]:font-semibold
          [&_a]:text-blue-700 [&_a]:underline [&_a]:break-words
          [&_table]:my-2 [&_table]:text-[12px] [&_table]:border-collapse
          [&_th]:bg-zinc-100 [&_th]:p-1.5 [&_th]:border [&_th]:border-zinc-300
          [&_td]:border [&_td]:border-zinc-300 [&_td]:p-1.5
        "
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {profundaResult.markdown}
        </ReactMarkdown>
      </div>

      {/* ─── Fontes consultadas ─────────────────────────────── */}
      {profundaResult.citations.length > 0 ? (
        <>
          <h2 style={sectionTitleStyle}>
            Fontes consultadas ({profundaResult.citations.length})
          </h2>
          <ol
            style={{
              paddingLeft: "20px",
              margin: 0,
              marginBottom: "24px",
              fontSize: "11px",
              lineHeight: 1.5,
            }}
          >
            {profundaResult.citations.map((c) => (
              <li key={c.url} style={{ marginBottom: "4px", wordBreak: "break-all" }}>
                <span style={{ fontWeight: 500 }}>{c.title || c.url}</span>
                {c.title && c.title !== c.url ? (
                  <>
                    <br />
                    <span style={{ color: "#71717a" }}>{c.url}</span>
                  </>
                ) : null}
              </li>
            ))}
          </ol>
        </>
      ) : null}

      {/* ─── Rodapé ─────────────────────────────────────────── */}
      <footer
        style={{
          marginTop: "32px",
          paddingTop: "12px",
          borderTop: "1px solid #e4e4e7",
          fontSize: "10px",
          color: "#a1a1aa",
          textAlign: "center",
        }}
      >
        Relatório gerado por My Home Collection · Análise profunda via
        Claude Sonnet 4.5 + web search · ITBI da Prefeitura de São Paulo
      </footer>
    </div>
  );
}

// ─── building blocks ─────────────────────────────────────────────────

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "15px",
  fontWeight: 700,
  margin: "16px 0 10px",
  color: "#18181b",
  borderBottom: "1.5px solid #e4e4e7",
  paddingBottom: "4px",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "6px 8px",
  fontSize: "11px",
  fontWeight: 600,
  color: "#3f3f46",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  borderBottom: "1px solid #d4d4d8",
};

const tdStyle: React.CSSProperties = {
  padding: "6px 8px",
  verticalAlign: "top",
};

interface CardPdfProps {
  titulo: string;
  subtitulo: string;
  dados: DadosFonte;
  accentColor: string;
}

function CardPdf({ titulo, subtitulo, dados, accentColor }: CardPdfProps) {
  const tem = dados.stats.count > 0;
  return (
    <div
      style={{
        border: `1px solid ${accentColor}40`,
        borderLeftWidth: "4px",
        borderLeftColor: accentColor,
        borderRadius: "6px",
        padding: "12px",
        backgroundColor: "#ffffff",
      }}
    >
      <p
        style={{
          fontSize: "11px",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          fontWeight: 600,
          color: accentColor,
          margin: 0,
        }}
      >
        {titulo}
      </p>
      <p
        style={{
          fontSize: "10px",
          color: "#71717a",
          margin: "2px 0 8px",
        }}
      >
        {subtitulo} · {tem ? `${dados.stats.count} pts` : "sem dados"}
      </p>
      {tem ? (
        <>
          <LinhaPdf
            rotulo="Mediana"
            valor={fmtBRLCompact(dados.stats.median)}
            destaque
          />
          <LinhaPdf
            rotulo="Faixa"
            valor={
              dados.stats.min != null && dados.stats.max != null
                ? `${fmtBRLCompact(dados.stats.min)} – ${fmtBRLCompact(dados.stats.max)}`
                : "—"
            }
          />
          {dados.stats.ultimoPreco != null ? (
            <LinhaPdf
              rotulo="Último"
              valor={
                dados.stats.ultimaData
                  ? `${fmtBRLCompact(dados.stats.ultimoPreco)} · ${fmtDate(dados.stats.ultimaData)}`
                  : fmtBRLCompact(dados.stats.ultimoPreco)
              }
            />
          ) : null}
        </>
      ) : (
        <p style={{ fontSize: "11px", color: "#a1a1aa", fontStyle: "italic", margin: 0 }}>
          Nenhuma transação encontrada.
        </p>
      )}
    </div>
  );
}

function LinhaPdf({
  rotulo,
  valor,
  destaque,
}: {
  rotulo: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: "8px",
        marginBottom: "3px",
      }}
    >
      <span style={{ fontSize: "11px", color: "#71717a" }}>{rotulo}</span>
      <span
        style={{
          fontSize: destaque ? "15px" : "12px",
          fontWeight: destaque ? 700 : 500,
          fontVariantNumeric: "tabular-nums",
          color: "#0a0a0a",
        }}
      >
        {valor}
      </span>
    </div>
  );
}
