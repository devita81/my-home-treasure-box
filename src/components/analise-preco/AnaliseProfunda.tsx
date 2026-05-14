import { useEffect, useState } from "react";
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
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import {
  runResearch,
  type ResearchCitation,
  type ResearchResponse,
} from "@/lib/ai-research";

interface AnaliseProfundaProps {
  property: Property;
}

/**
 * Forma persistida (mesmo shape do ResearchResponse mas sem
 * elapsedMs/usage — só importam no momento da geração). updatedAt
 * vem do banco; se a análise é fresca da chamada, fica null e usamos
 * Date.now() em runtime pra exibir.
 */
interface PersistedResearch {
  markdown: string;
  citations: ResearchCitation[];
  updatedAt: string | null;
}

/**
 * Card "Análise profunda" — pesquisa multi-fonte via Claude Sonnet 4.5
 * com web_search. Diferente da Estimativa IA antiga (que é uma única
 * chamada OpenAI single-shot), aqui o modelo de fato vai pra web,
 * busca em ZAP/VivaReal/QuintoAndar/OLX/ImovelWeb, lê os comparáveis
 * e produz um relatório com citações.
 *
 * Persistência:
 *   • Pré-cadastrados (property.id !== ""): grava nas 3 colunas
 *     ai_deep_research_* da tabela properties. Carrega na montagem
 *     se já existir. Mesmo padrão do useDadosEstimativaIa.
 *   • Avulsa (sem id): só em memória do componente — some quando o
 *     user sai da página de Pesquisa pontual.
 *
 * Estados:
 *   • Vazio: explicação + botão "Gerar análise profunda"
 *   • Loading: spinner + texto "Pesquisando ~10 sites... 30-90s"
 *   • Resultado: relatório markdown + fontes + timestamp + botão Refazer
 */
export function AnaliseProfunda({ property }: AnaliseProfundaProps) {
  const isPersisted = !!property.id;

  const [result, setResult] = useState<PersistedResearch | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingFromDb, setLoadingFromDb] = useState(isPersisted);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  // Latência só da chamada NOVA (não persistido — só mostramos
  // "Gerado em Xs" se a análise foi gerada nesta sessão)
  const [lastElapsedMs, setLastElapsedMs] = useState<number | null>(null);
  // Aviso visível quando o persist no DB falha — antes era só
  // console.error e o usuário não tinha como saber.
  const [persistError, setPersistError] = useState<string | null>(null);

  // Carrega do DB ao montar (só pra pré-cadastrados)
  useEffect(() => {
    if (!isPersisted) {
      setLoadingFromDb(false);
      return;
    }
    let cancelled = false;
    (async () => {
      // Cast `supabase as any` na origem da chain pra contornar os
      // generated types não terem ainda as colunas ai_deep_research_*.
      // Mesmo padrão do useDadosEstimativaIa linha ~70. Quando o Lovable
      // rodar a migration nova e regenerar os types, dá pra remover.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- generated types ainda não têm as colunas ai_deep_research_*
      const { data, error: dbErr } = await (supabase as any)
        .from("properties")
        .select(
          "ai_deep_research_md, ai_deep_research_citations, ai_deep_research_updated_at",
        )
        .eq("id", property.id)
        .maybeSingle();
      if (cancelled) return;
      if (dbErr) {
        logger.error("[AnaliseProfunda] erro lendo DB:", dbErr);
        setLoadingFromDb(false);
        return;
      }
      const row = data as {
        ai_deep_research_md?: string | null;
        ai_deep_research_citations?: ResearchCitation[] | null;
        ai_deep_research_updated_at?: string | null;
      } | null;
      if (row?.ai_deep_research_md) {
        setResult({
          markdown: row.ai_deep_research_md,
          citations: row.ai_deep_research_citations ?? [],
          updatedAt: row.ai_deep_research_updated_at ?? null,
        });
      }
      setLoadingFromDb(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [property.id, isPersisted]);

  const persist = async (res: ResearchResponse) => {
    if (!isPersisted) return;
    const updatePayload = {
      ai_deep_research_md: res.markdown,
      ai_deep_research_citations: res.citations,
      ai_deep_research_updated_at: new Date().toISOString(),
    };
    // Cast `supabase as any` pelo mesmo motivo do select acima (types
    // gerados ainda não conhecem as colunas).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- generated types ainda não têm as colunas ai_deep_research_*
    const { error: dbErr } = await (supabase as any)
      .from("properties")
      .update(updatePayload)
      .eq("id", property.id);
    if (dbErr) {
      // Log estruturado — antes só passávamos o objeto cru e o
      // PostgrestError ficava ilegível no console. Agora extraímos
      // code/message/details/hint pra diagnóstico rápido (ex: 42703
      // = column does not exist = migration não rodou no banco).
      logger.error("[AnaliseProfunda] erro gravando DB", {
        code: dbErr.code,
        message: dbErr.message,
        details: dbErr.details,
        hint: dbErr.hint,
      });
      // Sinaliza pro UI estado "salvou parcialmente" — usuário vê
      // resultado mas com aviso de que não persistiu.
      setPersistError(
        dbErr.code === "42703" || /column.*does not exist/i.test(dbErr.message ?? "")
          ? "Banco ainda não tem as colunas pra salvar (migration pendente). A análise aparece nesta sessão mas vai sumir quando recarregar."
          : "Não foi possível salvar a análise no banco. A análise aparece nesta sessão mas vai sumir quando recarregar.",
      );
    } else {
      setPersistError(null);
    }
  };

  const handleRun = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await runResearch({
        property: {
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
      setResult({
        markdown: res.markdown,
        citations: res.citations,
        updatedAt: new Date().toISOString(),
      });
      setLastElapsedMs(res.elapsedMs);
      await persist(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  };

  const handleRefazer = () => {
    setResult(null);
    setLastElapsedMs(null);
    handleRun();
  };

  // ─── render ────────────────────────────────────────────────────────

  // Enquanto carrega do DB no mount, segura tudo num skeleton leve
  // pra não dar "flash" do estado vazio antes de aparecer o cached.
  if (loadingFromDb) {
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
        {loading ? (
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
            {/* Aviso amarelo SE o persist falhou — usuário entende que
                a análise vai sumir ao recarregar */}
            {persistError ? (
              <div className="rounded-md border border-warning/50 bg-warning/10 p-2.5 text-label">
                <p className="font-medium text-warning-foreground">
                  Análise não salva
                </p>
                <p className="text-muted-foreground">{persistError}</p>
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

            <div className="flex flex-col gap-1.5 border-t border-border/40 pt-2 text-meta text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>
                {result.updatedAt
                  ? `Última análise: ${formatDateTime(result.updatedAt)}`
                  : "Análise recém-gerada"}
                {lastElapsedMs != null
                  ? ` · gerou em ${(lastElapsedMs / 1000).toFixed(1)}s`
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
