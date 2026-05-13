import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Property } from "@/types/property";
import {
  runResearch,
  getCachedResearch,
  setCachedResearch,
  clearCachedResearch,
  type ResearchResponse,
} from "@/lib/ai-research";

interface AnaliseProfundaProps {
  property: Property;
}

/**
 * Card "Análise profunda" — pesquisa multi-fonte via Claude Sonnet 4.5
 * com web_search. Diferente da Estimativa IA antiga (que é uma única
 * chamada OpenAI com prompt textual), aqui o modelo de fato vai pra
 * web, busca em ZAP/VivaReal/QuintoAndar/OLX/ImovelWeb, lê os
 * comparáveis e produz um relatório com citações.
 *
 * Estado:
 *   • Vazio: explicação + botão "Gerar análise profunda" (estimativa
 *     de tempo + custo pra usuário entender o trade-off)
 *   • Loading: barra indeterminada + texto "Pesquisando ~10 sites..."
 *   • Resultado: relatório markdown + lista de fontes + botão
 *     "Refazer análise" pra invalidar cache
 *
 * Cache: localStorage por property.id (ttl 7d). Pra Pesquisa pontual
 * de preço (avulsa, sem id), não cacheia — sai junto com a sessão.
 */
export function AnaliseProfunda({ property }: AnaliseProfundaProps) {
  const propertyId = property.id || null;

  const [result, setResult] = useState<ResearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  // Carrega cache na montagem se houver
  useEffect(() => {
    const cached = getCachedResearch(propertyId);
    if (cached) setResult(cached);
  }, [propertyId]);

  const handleRun = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await runResearch({
        property: {
          // Passa direto sem coerção — o Property type já tem
          // undefined onde aplica, e o Worker /research lida com
          // ambos undefined e null (só ignora campos faltantes).
          rua: property.rua,
          numero: property.numero,
          bairro: property.bairro,
          cidade: property.cidade,
          estado: property.estado,
          cep: property.cep,
          tipo_imovel: property.tipo_imovel,
          metragem: property.metragem,
          area_total: property.area_total,
          quartos: property.quartos,
          suites: property.suites,
          banheiros: property.banheiros,
          garagens: property.garagens,
          ano_construcao: property.ano_construcao,
        },
      });
      setResult(res);
      setCachedResearch(propertyId, res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  };

  const handleRefazer = () => {
    clearCachedResearch(propertyId);
    setResult(null);
    handleRun();
  };

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
          {result ? (
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
        {!result && !loading && !error ? (
          <div className="space-y-2.5">
            <p className="text-data text-muted-foreground">
              Pesquisa multi-fonte (ZAP, VivaReal, QuintoAndar, OLX) e
              produz relatório com comparáveis, faixa de preço de venda
              e aluguel, análise da região e recomendações práticas.
              Diferente da Estimativa IA acima (single-shot), aqui o
              modelo de fato lê páginas da web.
            </p>
            <p className="text-meta text-muted-foreground">
              Tempo: ~60s. Custo: ~R$ 1 por análise. Resultado fica
              cacheado por 7 dias.
            </p>
            <Button onClick={handleRun} className="gap-2">
              <Sparkles className="h-4 w-4" />
              Gerar análise profunda
            </Button>
          </div>
        ) : null}

        {/* LOADING: spinner + texto explicativo + barra pulsante */}
        {loading ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-data">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>
                Pesquisando ZAP, VivaReal, QuintoAndar, OLX... isso leva
                30-90 segundos.
              </span>
            </div>
            {/* Bar com pulse só pra dar atividade visual — Tailwind
                animate-pulse padrão (fade in/out). Não é progresso real
                porque não temos como medir, mas dá sensação de "tá
                rodando" sem ficar uma página estática. */}
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
        {error && !loading ? (
          <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 p-3">
            <p className="text-data font-medium text-destructive">
              Erro na análise
            </p>
            <p className="text-label text-muted-foreground">{error}</p>
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
        {result && expanded ? (
          <div className="space-y-3">
            <div className="prose prose-sm max-w-none text-data [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold [&_table]:my-2 [&_table]:text-label [&_th]:bg-muted [&_th]:p-1.5 [&_td]:border [&_td]:border-border [&_td]:p-1.5 [&_a]:text-primary [&_a]:underline [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {result.markdown}
              </ReactMarkdown>
            </div>

            {result.citations.length > 0 ? (
              <details className="rounded-md border border-border/60 p-2.5">
                <summary className="cursor-pointer text-label font-medium">
                  Fontes consultadas ({result.citations.length})
                </summary>
                <ul className="mt-2 space-y-1">
                  {result.citations.map((c) => (
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

            <div className="flex items-center justify-between border-t border-border/40 pt-2 text-meta text-muted-foreground">
              <span>
                Gerado em {(result.elapsedMs / 1000).toFixed(1)}s
                {result.usage
                  ? ` · ${result.usage.input_tokens} in / ${result.usage.output_tokens} out tokens`
                  : ""}
              </span>
              <Button
                onClick={handleRefazer}
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5"
              >
                <RefreshCw className="h-3 w-3" />
                Refazer
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
