import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Property } from "@/types/property";
import { useAnaliseProfunda } from "./dados/useAnaliseProfunda";

interface AnaliseProfundaProps {
  property: Property;
}

/**
 * Card "Análise profunda" — pesquisa multi-fonte via Claude Sonnet 4.5
 * com web_search. Diferente da Estimativa IA antiga (que é uma única
 * chamada OpenAI single-shot), aqui o modelo de fato vai pra web,
 * busca em ZAP/VivaReal/QuintoAndar/OLX/ImovelWeb, lê os comparáveis
 * e produz um relatório com citações.
 *
 * O lifecycle de dado (carregar do DB / disparar runResearch /
 * persistir) vive em `useAnaliseProfunda` (react-query) — esse
 * componente é só render. O hook compartilhado permite que outros
 * componentes (ex: BotaoExportarPdf) leiam o MESMO resultado sem
 * duplicar a chamada ao Worker (que custa ~R$ 1 cada).
 *
 * Persistência:
 *   • Pré-cadastrados (property.id !== ""): grava nas 3 colunas
 *     ai_deep_research_* da tabela properties. Carrega na montagem
 *     se já existir.
 *   • Avulsa (sem id): cache só em memória do react-query — some
 *     quando o user sai da página de Pesquisa pontual.
 *
 * Estados:
 *   • Vazio: explicação + botão "Gerar análise profunda"
 *   • Loading: spinner + texto "Pesquisando ~10 sites... 30-90s"
 *   • Resultado: relatório markdown + fontes + timestamp + botão Refazer
 */
export function AnaliseProfunda({ property }: AnaliseProfundaProps) {
  const isPersisted = !!property.id;
  const state = useAnaliseProfunda(property);

  // `expanded` é puramente UI (collapse do card) — fica local.
  const [expanded, setExpanded] = useState(true);

  // Wrappers que ignoram o Promise retornado pra usar como onClick
  // (botões não devem receber handlers async direto).
  const handleRun = () => {
    void state.run().catch(() => {
      // erro já fica em state.error, render mostra o card de erro
    });
  };
  const handleRefazer = () => {
    void state.refazer().catch(() => {
      // idem
    });
  };

  // ─── render ────────────────────────────────────────────────────────

  // Enquanto carrega do DB no mount, segura tudo num skeleton leve
  // pra não dar "flash" do estado vazio antes de aparecer o cached.
  if (state.loadingFromDb) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            Análise profunda
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-label text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Carregando última análise...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2 text-lg">
          <span className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Análise profunda
            <span className="text-meta font-normal text-muted-foreground">
              (Claude + web)
            </span>
          </span>
          {state.result ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded((v) => !v)}
              className="h-7 px-2"
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          ) : null}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Estado VAZIO: explica o que faz e botão de gerar */}
        {!state.result && !state.loading && !state.error ? (
          <div className="space-y-2.5">
            <p className="text-data text-muted-foreground">
              Pesquisa multi-fonte (ZAP, VivaReal, QuintoAndar, OLX) e
              produz relatório com comparáveis, faixa de preço de venda
              e aluguel, análise da região e recomendações práticas.
              Diferente da Estimativa IA acima (single-shot), aqui o
              modelo de fato lê páginas da web.
            </p>
            <p className="text-meta text-muted-foreground">
              Tempo: ~60s. Custo: ~R$ 1 por análise.
              {isPersisted
                ? " Fica salva no banco — vai aparecer sempre que abrir esse imóvel."
                : " Não cacheia — análise pontual."}
            </p>
            <Button onClick={handleRun} className="gap-2">
              <Sparkles className="h-4 w-4" />
              Gerar análise profunda
            </Button>
          </div>
        ) : null}

        {/* LOADING: spinner + texto explicativo + barra pulsante */}
        {state.loading ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-data">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>
                Pesquisando ZAP, VivaReal, QuintoAndar, OLX... isso leva
                30-90 segundos.
              </span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-primary/20">
              <div className="h-full w-full animate-pulse bg-primary" />
            </div>
            <p className="text-meta text-muted-foreground">
              Não feche a página. A análise faz ~10 buscas e lê os
              resultados antes de gerar o relatório.
            </p>
          </div>
        ) : null}

        {/* ERRO: mensagem + retry */}
        {state.error && !state.loading ? (
          <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 p-3">
            <p className="text-data font-medium text-destructive">
              Erro na análise
            </p>
            <p className="text-label text-muted-foreground">{state.error}</p>
            <Button
              onClick={handleRun}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Tentar de novo
            </Button>
          </div>
        ) : null}

        {/* RESULTADO: relatório markdown + fontes + botão refazer */}
        {state.result && expanded ? (
          <div className="space-y-3">
            {/* Aviso amarelo SE o persist falhou — usuário entende que
                a análise vai sumir ao recarregar */}
            {state.persistError ? (
              <div className="rounded-md border border-warning/50 bg-warning/10 p-2.5 text-label">
                <p className="font-medium text-warning-foreground">
                  Análise não salva
                </p>
                <p className="text-muted-foreground">{state.persistError}</p>
              </div>
            ) : null}

            {/* Container do relatório — todo o styling via classes
                arbitrárias do Tailwind aplicadas aos elementos gerados
                pelo react-markdown. O prompt do Worker pede listas
                (não tabelas), por isso o estilo prioriza bullets e
                sub-bullets. Tabelas ainda têm estilo de fallback caso
                o modelo escape e gere uma, e ganham overflow-x pra
                não estourar o card em mobile. */}
            <div
              className="
                text-data leading-relaxed
                [&>*:first-child]:mt-0
                [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:border-b [&_h2]:border-border/60 [&_h2]:pb-1
                [&_h3]:mt-4 [&_h3]:mb-1.5 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-foreground
                [&_p]:my-2
                [&_ul]:my-2 [&_ul]:pl-5 [&_ul]:list-disc [&_ul]:space-y-1
                [&_ol]:my-2 [&_ol]:pl-5 [&_ol]:list-decimal [&_ol]:space-y-1
                [&_li]:pl-1
                [&_li>ul]:mt-1 [&_li>ul]:mb-0
                [&_strong]:font-semibold [&_strong]:text-foreground
                [&_a]:text-primary [&_a]:underline [&_a]:break-words
                [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-label
                [&_table]:my-3 [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto [&_table]:text-label [&_table]:border-collapse
                [&_th]:bg-muted [&_th]:p-1.5 [&_th]:text-left [&_th]:border [&_th]:border-border
                [&_td]:border [&_td]:border-border [&_td]:p-1.5 [&_td]:align-top
              "
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {state.result.markdown}
              </ReactMarkdown>
            </div>

            {state.result.citations.length > 0 ? (
              <details className="rounded-md border border-border/60 p-2.5">
                <summary className="cursor-pointer text-label font-medium">
                  Fontes consultadas ({state.result.citations.length})
                </summary>
                <ul className="mt-2 space-y-1">
                  {state.result.citations.map((c) => (
                    <li key={c.url} className="text-label">
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline break-all"
                      >
                        {c.title || c.url}
                      </a>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}

            <div className="flex flex-col gap-1.5 border-t border-border/40 pt-2 text-meta text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>
                {state.result.updatedAt
                  ? `Última análise: ${formatDateTime(state.result.updatedAt)}`
                  : "Análise recém-gerada"}
                {state.lastElapsedMs != null
                  ? ` · gerou em ${(state.lastElapsedMs / 1000).toFixed(1)}s`
                  : ""}
              </span>
              <Button
                onClick={handleRefazer}
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 self-start sm:self-auto"
              >
                <RefreshCw className="h-3 w-3" />
                Refazer análise
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────

/**
 * "dd/mm/yyyy às HH:mm" pra timestamp ISO. Falha gracioso retornando
 * a string crua se a Date construction der ruim.
 */
function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
