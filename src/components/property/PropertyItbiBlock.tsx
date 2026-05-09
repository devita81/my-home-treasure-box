import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, RefreshCw, Database, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
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
      tipos: tiposForProperty(property.tipo_imovel),
      logradouro: property.rua,
      numero: property.numero,
    }),
    [property.tipo_imovel, property.rua, property.numero],
  );

  const refreshMutation = useMutation({
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

      // Persistence is opportunistic. If the row update fails (RLS
      // denial, transient network error, etc.) we still want the
      // user to see the freshly-fetched results — just with a
      // visible warning that the cache wasn't saved, so the next
      // page-load will re-fetch instead of showing stale data.
      let persisted = false;
      if (property.id) {
        const { error: updateErr } = await supabase
          .from("properties")
          .update({ itbi_cache: next as unknown as Json })
          .eq("id", property.id);
        if (updateErr) {
          console.error("[ITBI] failed to persist cache:", updateErr);
        } else {
          persisted = true;
        }
      }
      return { next, persisted };
    },
    onSuccess: ({ next, persisted }) => {
      // Always update the local view — the search itself succeeded.
      setCache(next);
      onCacheUpdated?.(next);
      if (persisted) {
        toast.success(`ITBI atualizado — ${next.results.length} transações`);
      } else {
        toast.warning("Resultados carregados mas não salvos", {
          description:
            "Na próxima visita o histórico será buscado de novo. Verifique sua conexão.",
        });
      }
    },
    onError: (err) => {
      toast.error("Falha ao buscar ITBI", {
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
                tipos={cache.params.tipos ?? []}
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
  tipos,
  isLoading,
  onRefresh,
}: {
  fetchedAt: string;
  tipos: string[];
  isLoading: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
      <span>
        Última atualização: {fmtDate(fetchedAt)} · Filtrando por:{" "}
        <span className="font-medium text-foreground">{describeTipos(tipos)}</span>
      </span>
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

  // Selected row drives the details dialog. Null = closed.
  const [selected, setSelected] = useState<ItbiResult | null>(null);

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <p className="border-b border-border px-3 py-2 text-xs text-muted-foreground">
          Transações ({rows.length} de {results.length} mostradas) — clique em uma linha para detalhes
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
                <tr
                  key={r.id}
                  onClick={() => setSelected(r)}
                  className="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-muted/50"
                >
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

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Detalhes da transação</DialogTitle>
          </DialogHeader>
          {selected ? <ItbiTransactionDetails row={selected} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Read-only field list for one ITBI transaction. Headline shows the
 * transaction date + value; below, a definition list with everything
 * the row carries (address parts, areas, valor venal, SQL IPTU).
 */
function ItbiTransactionDetails({ row }: { row: ItbiResult }) {
  const fullAddress = [
    row.logradouro,
    row.numero,
    row.complemento,
  ]
    .filter(Boolean)
    .join(", ");

  const fields: Array<{ label: string; value: string }> = [
    { label: "Endereço", value: fullAddress || "—" },
    { label: "Bairro", value: row.bairro ?? "—" },
    { label: "CEP", value: row.cep ?? "—" },
    {
      label: "Área construída",
      value: row.area_construida != null ? `${row.area_construida} m²` : "—",
    },
    { label: "Valor venal", value: fmtBRL(row.valor_venal) },
    { label: "SQL / IPTU", value: row.sql_iptu ?? "—" },
  ];

  return (
    <div className="space-y-4">
      {/* Headline */}
      <div className="rounded-lg border border-border bg-muted/40 p-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Transação em {fmtDate(row.data_transacao)}
        </p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">
          {fmtBRL(row.valor_transacao)}
        </p>
      </div>

      {/* Field list */}
      <dl className="grid grid-cols-3 gap-x-3 gap-y-2 text-sm">
        {fields.map((f) => (
          <div key={f.label} className="contents">
            <dt className="text-muted-foreground">{f.label}</dt>
            <dd className="col-span-2 break-words text-foreground">{f.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────

/**
 * Map the property's `tipo_imovel` to the ITBI search filter array.
 *
 * Critical: when the property's tipo isn't a recognised category we
 * return an empty array (no tipo filter), which makes the search
 * return ALL categories. The previous behaviour silently defaulted to
 * `["apartamento"]`, so a user with a `Casa` would see an apartment-
 * only history without any indication that filtering was happening.
 */
function tiposForProperty(tipo: string | null | undefined): string[] {
  const t = (tipo ?? "").toLowerCase().trim();
  if (t === "apartamento" || t === "casa") return [t];
  return []; // unknown / missing → no tipo filter, return everything
}

/** Human-readable label for the tipo filter currently in use. */
function describeTipos(tipos: string[]): string {
  if (tipos.length === 0) return "Todos os tipos";
  return tipos
    .map((t) => (t === "apartamento" ? "Apartamentos" : t === "casa" ? "Casas" : t))
    .join(" + ");
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
