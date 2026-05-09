import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { fmtDate } from "@/lib/format";
import { priceStats } from "@/lib/price-stats";
import {
  type ItbiCache,
  type ItbiResult,
  type ItbiSearchParams,
} from "@/components/itbi/itbi-stats";
import type { Property } from "@/types/property";
import type { DadosFonte, ModoPreco, PontoPreco } from "./tipos";

type ItbiPropertyInput = Pick<
  Property,
  "id" | "rua" | "numero" | "bairro" | "tipo_imovel"
> & {
  itbi_cache?: ItbiCache | unknown | null;
};

/**
 * Adapter ITBI para a `<AnalisePreco>`. Lê o cache persistido em
 * `properties.itbi_cache` e expõe um `refetch` que dispara a edge
 * function `itbi-search` para repopular o cache.
 *
 * ITBI sempre é venda — quando o modo for `aluguel` retorna estado
 * vazio sem disparar nada (o `<CardResumoFonte>` mostra "—").
 */
export function useDadosItbi(
  property: ItbiPropertyInput,
  modo: ModoPreco,
): DadosFonte {
  const [cache, setCache] = useState<ItbiCache | null>(() =>
    normalizeCache(property.itbi_cache),
  );

  const params = useMemo<ItbiSearchParams>(
    () => ({
      tipos: tiposForProperty(property.tipo_imovel),
      logradouro: property.rua,
      numero: property.numero,
    }),
    [property.tipo_imovel, property.rua, property.numero],
  );

  const refresh = useMutation({
    retry: 1,
    retryDelay: 600,
    mutationFn: async (): Promise<{ next: ItbiCache; persisted: boolean }> => {
      const { data, error } = await supabase.functions.invoke<{
        results?: ItbiResult[];
        total?: number;
        error?: string;
      }>("itbi-search", { body: params });
      if (error) throw error;
      if (!data || data.error) throw new Error(data?.error ?? "Sem resposta");

      const next: ItbiCache = {
        fetched_at: new Date().toISOString(),
        params,
        results: data.results ?? [],
      };

      let persisted = false;
      if (property.id) {
        const { error: updateErr } = await supabase
          .from("properties")
          .update({ itbi_cache: next as unknown as Json })
          .eq("id", property.id);
        if (!updateErr) persisted = true;
      }
      return { next, persisted };
    },
    onSuccess: ({ next, persisted }) => {
      setCache(next);
      if (persisted) {
        toast.success(`ITBI atualizado — ${next.results.length} transações`);
      } else {
        toast.warning("Resultados carregados mas não salvos", {
          description: "Na próxima visita o histórico será buscado de novo.",
        });
      }
    },
    onError: (err) => {
      toast.error("Falha ao buscar ITBI", {
        description: err instanceof Error ? err.message : "Erro desconhecido",
      });
    },
  });

  // ITBI só tem venda. No modo aluguel devolvemos um estado válido
  // mas vazio — a UI mostra "—" e o gráfico vira null.
  const isAluguel = modo === "aluguel";

  const pontos = useMemo<PontoPreco[]>(() => {
    if (isAluguel || !cache) return [];
    return cache.results
      .map((r) => transacaoParaPonto(r))
      .filter((p): p is PontoPreco => p !== null);
  }, [cache, isAluguel]);

  const stats = useMemo(() => {
    const base = priceStats(pontos.map((p) => p.preco));
    let ultimoPreco: number | null = null;
    let ultimaData: string | null = null;
    for (const p of pontos) {
      if (!p.data) continue;
      if (ultimaData === null || p.data > ultimaData) {
        ultimaData = p.data;
        ultimoPreco = p.preco;
      }
    }
    return { ...base, ultimoPreco, ultimaData };
  }, [pontos]);

  return {
    fonte: "itbi",
    rotulo: "Histórico ITBI",
    origem: "Prefeitura de São Paulo",
    pontos,
    stats,
    asOf: cache?.fetched_at ?? null,
    isLoading: refresh.isPending,
    isError: refresh.isError,
    errorMessage:
      refresh.error instanceof Error ? refresh.error.message : undefined,
    refetch: () => {
      if (isAluguel) {
        toast.info("ITBI registra apenas vendas");
        return;
      }
      refresh.mutate();
    },
    verMaisHref: "/itbi-search",
  };
}

// ─── helpers ─────────────────────────────────────────────────────────

function transacaoParaPonto(r: ItbiResult): PontoPreco | null {
  const preco =
    typeof r.valor_transacao === "number"
      ? r.valor_transacao
      : Number(r.valor_transacao);
  if (!Number.isFinite(preco) || preco <= 0) return null;

  const area =
    typeof r.area_construida === "number"
      ? r.area_construida
      : Number(r.area_construida);

  return {
    id: `itbi:${r.id}`,
    fonte: "itbi",
    modo: "venda",
    preco,
    area: Number.isFinite(area) && area > 0 ? area : undefined,
    data: r.data_transacao ?? undefined,
    display: {
      primary: r.data_transacao ? fmtDate(r.data_transacao) : "Transação",
      secondary: r.complemento ?? undefined,
    },
    acao: { tipo: "modal-itbi", transacao: r },
  };
}

function tiposForProperty(tipo: string | null | undefined): string[] {
  const t = (tipo ?? "").toLowerCase().trim();
  if (t === "apartamento" || t === "casa") return [t];
  return [];
}

function normalizeCache(raw: unknown): ItbiCache | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.fetched_at !== "string") return null;
  if (!o.params || typeof o.params !== "object") return null;
  if (!Array.isArray(o.results)) return null;
  return o as unknown as ItbiCache;
}
