import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { priceStats } from "@/lib/price-stats";
import type { Property } from "@/types/property";
import type { DadosFonte, ModoPreco, PontoPreco } from "./tipos";

type IaPropertyInput = Pick<
  Property,
  | "id"
  | "cidade"
  | "estado"
  | "bairro"
  | "rua"
  | "numero"
  | "tipo_imovel"
  | "quartos"
  | "suites"
  | "banheiros"
  | "garagens"
  | "metragem"
  | "area_total"
  | "ano_construcao"
>;

interface IaEstimativasRow {
  ai_market_estimate: string | null;
  ai_market_estimate_updated_at: string | null;
  ai_venda_min: number | null;
  ai_venda_med: number | null;
  ai_venda_max: number | null;
  ai_aluguel_min: number | null;
  ai_aluguel_med: number | null;
  ai_aluguel_max: number | null;
}

interface IaState {
  row: IaEstimativasRow | null;
  loading: boolean;
}

/**
 * Adapter Estimativa IA para a `<AnalisePreco>`. Lê as colunas
 * `ai_*` já estruturadas na tabela `properties` (mín / médio / máx
 * para venda e aluguel) e dispara `search-property-info` quando
 * o usuário pede pra atualizar.
 *
 * Diferente de ITBI/Anúncios, a IA gera 3 pontos por modo
 * (mín / médio / máx) sem dimensão de metragem. O `<GraficoEstimativaIa>`
 * renderiza esses pontos como uma barra de range vertical.
 */
export function useDadosEstimativaIa(
  property: IaPropertyInput,
  modo: ModoPreco,
): DadosFonte {
  const [state, setState] = useState<IaState>({ row: null, loading: true });

  // Carrega o que tá no banco. Marca `loading: false` mesmo se a
  // linha vier vazia — significa "nunca rodou", não "buscando".
  useEffect(() => {
    if (!property.id) {
      setState({ row: null, loading: false });
      return;
    }
    let cancelled = false;
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- supabase generated types ainda não têm as colunas ai_*
      const { data, error } = await (supabase as any)
        .from("properties")
        .select(
          "ai_market_estimate, ai_market_estimate_updated_at, ai_venda_min, ai_venda_med, ai_venda_max, ai_aluguel_min, ai_aluguel_med, ai_aluguel_max",
        )
        .eq("id", property.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        logger.error("[IA] erro lendo estimativas:", error);
        setState({ row: null, loading: false });
        return;
      }
      setState({ row: (data as IaEstimativasRow) ?? null, loading: false });
    })();
    return () => {
      cancelled = true;
    };
  }, [property.id]);

  const refresh = useMutation({
    retry: 1,
    retryDelay: 800,
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke<{
        result?: string;
        error?: string;
      }>("search-property-info", {
        body: {
          cidade: property.cidade,
          rua: property.rua,
          numero: property.numero,
          bairro: property.bairro,
          estado: property.estado,
          tipo_imovel: property.tipo_imovel,
          quartos: property.quartos,
          suites: property.suites,
          banheiros: property.banheiros,
          garagens: property.garagens,
          metragem: property.metragem,
          area_total: property.area_total,
          ano_construcao: property.ano_construcao,
        },
      });
      if (error) throw error;
      if (!data?.result) throw new Error(data?.error ?? "Sem resposta");

      const parsed = parseEstimatesFromMarkdown(data.result);

      // Persiste markdown completo + colunas estruturadas. Se falhar,
      // ainda mostramos os números na UI mas avisamos que não foi
      // salvo (próxima visita pede de novo).
      let persisted = false;
      if (property.id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- supabase generated types ainda não têm as colunas ai_*
        const { error: updateError } = await (supabase as any)
          .from("properties")
          .update({
            ai_market_estimate: data.result,
            ai_market_estimate_updated_at: new Date().toISOString(),
            ...parsed,
          })
          .eq("id", property.id);
        if (!updateError) persisted = true;
      }

      const nextRow: IaEstimativasRow = {
        ai_market_estimate: data.result,
        ai_market_estimate_updated_at: new Date().toISOString(),
        ai_venda_min: parsed.ai_venda_min,
        ai_venda_med: parsed.ai_venda_med,
        ai_venda_max: parsed.ai_venda_max,
        ai_aluguel_min: parsed.ai_aluguel_min,
        ai_aluguel_med: parsed.ai_aluguel_med,
        ai_aluguel_max: parsed.ai_aluguel_max,
      };

      return { row: nextRow, persisted };
    },
    onSuccess: ({ row, persisted }) => {
      setState({ row, loading: false });
      if (persisted) toast.success("Estimativa IA atualizada");
      else toast.warning("Estimativa gerada mas não salva");
    },
    onError: (err) => {
      toast.error("Falha ao gerar estimativa IA", {
        description: err instanceof Error ? err.message : "Erro desconhecido",
      });
    },
  });

  const pontos = useMemo<PontoPreco[]>(
    () => extrairPontos(state.row, modo),
    [state.row, modo],
  );

  const stats = useMemo(() => {
    const base = priceStats(pontos.map((p) => p.preco));
    // IA não tem dimensão temporal — `ultimoPreco` fica null.
    return { ...base, ultimoPreco: null, ultimaData: null };
  }, [pontos]);

  return {
    fonte: "estimativa_ia",
    rotulo: "Estimativa IA",
    origem: "ChatGPT",
    pontos,
    stats,
    asOf: state.row?.ai_market_estimate_updated_at ?? null,
    isLoading: state.loading || refresh.isPending,
    isError: refresh.isError,
    errorMessage:
      refresh.error instanceof Error ? refresh.error.message : undefined,
    refetch: () => refresh.mutate(),
    markdown: state.row?.ai_market_estimate ?? null,
  };
}

// ─── helpers ─────────────────────────────────────────────────────────

interface IaParsedNumbers {
  ai_venda_min: number | null;
  ai_venda_med: number | null;
  ai_venda_max: number | null;
  ai_aluguel_min: number | null;
  ai_aluguel_med: number | null;
  ai_aluguel_max: number | null;
}

/**
 * Extrai os 3 pontos por modo das colunas estruturadas na linha
 * `properties`. Cada ponto é taggeado com a banda (mín/médio/máx)
 * pra o `<GraficoEstimativaIa>` saber onde colocar o marcador.
 */
function extrairPontos(
  row: IaEstimativasRow | null,
  modo: ModoPreco,
): PontoPreco[] {
  if (!row) return [];
  const cols =
    modo === "venda"
      ? {
          min: row.ai_venda_min,
          med: row.ai_venda_med,
          max: row.ai_venda_max,
        }
      : {
          min: row.ai_aluguel_min,
          med: row.ai_aluguel_med,
          max: row.ai_aluguel_max,
        };

  const pontos: PontoPreco[] = [];
  const md = row.ai_market_estimate ?? "";
  const labels: { key: keyof typeof cols; label: string }[] = [
    { key: "min", label: "Estimativa mínima" },
    { key: "med", label: "Estimativa média" },
    { key: "max", label: "Estimativa máxima" },
  ];
  for (const { key, label } of labels) {
    const v = cols[key];
    if (v == null || !Number.isFinite(v) || v <= 0) continue;
    pontos.push({
      id: `ia:${modo}:${key}`,
      fonte: "estimativa_ia",
      modo,
      preco: v,
      display: { primary: label },
      acao: { tipo: "modal-ia", markdown: md },
    });
  }
  return pontos;
}

/**
 * Parser do markdown vindo da edge function `search-property-info`.
 * Procura linhas de tabela com "Valor de Venda" e "Aluguel Mensal"
 * — mesma heurística que vivia inline no `PropertyDetails.tsx`.
 */
export function parseEstimatesFromMarkdown(result: string): IaParsedNumbers {
  const out: IaParsedNumbers = {
    ai_venda_min: null,
    ai_venda_med: null,
    ai_venda_max: null,
    ai_aluguel_min: null,
    ai_aluguel_med: null,
    ai_aluguel_max: null,
  };

  for (const raw of result.split("\n")) {
    if (!raw.includes("|")) continue;
    const cells = raw
      .split("|")
      .map((c) => c.trim())
      .filter(Boolean);
    if (cells.length < 4) continue;

    const label = cells[0].toLowerCase();
    if (label.includes("venda") && !label.includes("m²") && !label.includes("preço")) {
      out.ai_venda_min = parseBRL(cells[1]);
      out.ai_venda_max = parseBRL(cells[2]);
      out.ai_venda_med = parseBRL(cells[3]);
    } else if (label.includes("aluguel")) {
      out.ai_aluguel_min = parseBRL(cells[1]);
      out.ai_aluguel_max = parseBRL(cells[2]);
      out.ai_aluguel_med = parseBRL(cells[3]);
    }
  }
  return out;
}

function parseBRL(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/R\$|\/m²|\/m2|\s/gi, "").trim();
  if (!cleaned) return null;
  const normalized = cleaned.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(normalized);
  return Number.isFinite(num) ? num : null;
}
