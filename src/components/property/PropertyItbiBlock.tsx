import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, RefreshCw, Database, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  type ItbiCache,
  type ItbiResult,
  type ItbiSearchParams,
  computeItbiStats,
  fmtBRL,
  fmtDate,
} from "@/components/itbi/itbi-stats";
import { ItbiStatsRow } from "@/components/itbi/ItbiStatsRow";
import { ItbiScatterChart } from "@/components/itbi/ItbiScatterChart";
import type { Property } from "@/types/property";

type ItbiPropertyInput = Pick<
  Property,
  "id" | "rua" | "numero" | "bairro" | "tipo_imovel"
> & {
  itbi_cache?: ItbiCache | unknown | null;
};

interface PropertyItbiBlockProps {
  property: ItbiPropertyInput;
  /**
   * Optional — called after a refresh persists new data, so the parent
   * can re-fetch the property and update the local copy of `itbi_cache`.
   * If omitted the block falls back to optimistic local state.
   */
  onCacheUpdated?: (cache: ItbiCache) => void;
}

/**
 * Per-property ITBI history block. Lives on PropertyDetails inside
 * "Ver detalhes" as a collapsible card. The first time a user expands
 * it (or clicks "Atualizar"), we hit the `itbi-search` edge function
 * with the property's address and persist the result in
 * `properties.itbi_cache`. Subsequent renders read straight from the
 * cache — no network round trip until the user manually refreshes.
 */
export function PropertyItbiBlock({ property, onCacheUpdated }: PropertyItbiBlockProps) {
  const [expanded, setExpanded] = useState(false);
  // Local copy of the cache. Initialised from the property row, kept
  // in sync after a refresh. Lets us update the UI immediately without
  // waiting for the parent to re-fetch.
  const [cache, setCache] = useState<ItbiCache | null>(() => normalizeCache(property.itbi_cache));

  // Build the search params from the current property fields. We
  // intentionally only filter by tipo + logradouro + numero — bairro
  // / cep are too noisy and would over-filter.
  const params = useMemo<ItbiSearchParams>(
    () => ({
      tipos: [normalizeTipo(property.tipo_imovel)],
      logradouro: property.rua,
      numero: property.numero,
    }),
    [property.tipo_imovel, property.rua, property.numero],
  );

  const refreshMutation = useMutation({
    mutationFn: async (): Promise<ItbiCache> => {
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

      if (property.id) {
        const { error: updateErr } = await supabase
          .from("properties")
          .update({ itbi_cache: next })
          .eq("id", property.id);
        if (updateErr) throw updateErr;
      }
      return next;
    },
    onSuccess: (next) => {
      setCache(next);
      onCacheUpdated?.(next);
      toast.success(`ITBI atualizado — ${next.results.length} transações`);
    },
    onError: (err) => {
      toast.error("Falha ao atualizar ITBI", {
        description: err instanceof Error ? err.message : "Erro desconhecido",
      });
    },
  });

  const stats = useMemo(
    () => (cache ? computeItbiStats(cache.results) : null),
    [cache],
  );

  const canSearch = Boolean(property.rua && property.numero);

  return (
    <Card>
      <CardHeader
        className="cursor-pointer pb-2"
        onClick={() => setExpanded((v) => !v)}
      >
        <CardTitle className="flex items-center justify-between gap-2 text-lg">
          <span className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Histórico ITBI deste prédio
            {stats && stats.count > 0 ? (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-normal text-muted-foreground">
                {stats.count} transações
              </span>
            ) : null}
          </span>
          <span className="text-muted-foreground">
            {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </span>
        </CardTitle>
      </CardHeader>

      {expanded ? (
        <CardContent className="space-y-4">
          {!canSearch ? (
            <p className="text-sm text-muted-foreground">
              Preencha rua e número da propriedade para buscar o histórico ITBI.
            </p>
          ) : !cache ? (
            <EmptyState
              isLoading={refreshMutation.isPending}
              onRefresh={() => refreshMutation.mutate()}
            />
          ) : (
            <>
              <RefreshHeader
                fetchedAt={cache.fetched_at}
                isLoading={refreshMutation.isPending}
                onRefresh={() => refreshMutation.mutate()}
              />
              {stats && stats.count > 0 ? (
                <>
                  <ItbiStatsRow stats={stats} />
                  <ItbiScatterChart results={cache.results} />
                  <ItbiResultsTable results={cache.results} />
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhuma transação ITBI encontrada para este endereço.
                </p>
              )}
            </>
          )}
          {refreshMutation.isError ? (
            <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>
                Falha ao buscar ITBI:{" "}
                {refreshMutation.error instanceof Error
                  ? refreshMutation.error.message
                  : "erro desconhecido"}
              </span>
            </div>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  );
}

// ─── subcomponents ───────────────────────────────────────────────────

function EmptyState({ isLoading, onRefresh }: { isLoading: boolean; onRefresh: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <p className="max-w-md text-sm text-muted-foreground">
        Carregue o histórico de transações ITBI para este endereço — usa a base oficial da Prefeitura de São Paulo.
      </p>
      <Button onClick={onRefresh} disabled={isLoading} size="sm">
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Buscando…
          </>
        ) : (
          <>
            <Database className="mr-2 h-4 w-4" />
            Carregar histórico ITBI
          </>
        )}
      </Button>
    </div>
  );
}

function RefreshHeader({
  fetchedAt,
  isLoading,
  onRefresh,
}: {
  fetchedAt: string;
  isLoading: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
      <span>Última atualização: {fmtDate(fetchedAt)}</span>
      <Button onClick={onRefresh} disabled={isLoading} variant="outline" size="sm">
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            Atualizando…
          </>
        ) : (
          <>
            <RefreshCw className="mr-2 h-3 w-3" />
            Atualizar
          </>
        )}
      </Button>
    </div>
  );
}

function ItbiResultsTable({ results }: { results: ItbiResult[] }) {
  // Sort newest first; cap at 50 visible rows so the block doesn't
  // explode on long histories. The full set is still in the cache
  // and the user can hit the standalone search page for deep dives.
  const rows = useMemo(() => {
    return [...results]
      .sort((a, b) => (b.data_transacao ?? "").localeCompare(a.data_transacao ?? ""))
      .slice(0, 50);
  }, [results]);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <p className="border-b border-border px-3 py-2 text-xs text-muted-foreground">
        Transações ({rows.length} de {results.length} mostradas)
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-3 py-2 text-left font-medium">Data</th>
              <th className="px-3 py-2 text-left font-medium">Compl.</th>
              <th className="px-3 py-2 text-right font-medium">Área</th>
              <th className="px-3 py-2 text-right font-medium">Valor</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0">
                <td className="px-3 py-1.5">{fmtDate(r.data_transacao)}</td>
                <td className="px-3 py-1.5 text-muted-foreground">{r.complemento ?? "—"}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {r.area_construida != null ? `${r.area_construida} m²` : "—"}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums font-medium">
                  {fmtBRL(r.valor_transacao)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────

function normalizeTipo(tipo: string | null | undefined): string {
  const t = (tipo ?? "").toLowerCase();
  if (t === "apartamento" || t === "casa") return t;
  // Default: residential broad search (matches both apartamento + casa)
  return "apartamento";
}

/**
 * Validate a JSONB blob from `properties.itbi_cache` against our shape.
 * Old rows or hand-edited values may be partially malformed; we only
 * accept blobs that look like a real cache so the rest of the
 * component can assume strict typing.
 */
function normalizeCache(raw: unknown): ItbiCache | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.fetched_at !== "string") return null;
  if (!o.params || typeof o.params !== "object") return null;
  if (!Array.isArray(o.results)) return null;
  return o as unknown as ItbiCache;
}
