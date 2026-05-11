import { useState } from "react";
import { useProperties } from "@/contexts/PropertyContext";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  X,
  Filter,
  ArrowDownUp,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  type SortField,
  type PropertyFilters as PropertyFiltersType,
} from "@/types/property";

// ─── tabelas de referência ───────────────────────────────────────────

const TIPOS_IMOVEL = [
  { value: "apartamento", label: "Apartamento" },
  { value: "casa", label: "Casa" },
  { value: "terreno", label: "Terreno" },
  { value: "conjunto_comercial", label: "Conj. Comercial" },
  { value: "garagem", label: "Garagem" },
];

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: "updated_at", label: "Última atualização" },
  { value: "declared_value", label: "Valor declarado" },
  { value: "market_value", label: "Valor de mercado" },
  { value: "iptu_value", label: "IPTU" },
  { value: "valor_aluguel", label: "Aluguel" },
  { value: "valor_condominio", label: "Condomínio" },
  { value: "cidade", label: "Cidade" },
  { value: "area_total", label: "Área total" },
  { value: "rua", label: "Nome da rua" },
];

const INITIAL_FILTERS: PropertyFiltersType = {
  search: "",
  estado: "",
  cidade: "",
  bairro: "",
  tipoImovel: "",
  proprietarioPapel: "",
  proprietarioMatricula: "",
  status: "all",
  validado: "all",
  sortField: "updated_at",
  sortOrder: "desc",
};

// ─── componente ──────────────────────────────────────────────────────

/**
 * Filtros compactos: busca prominent + botão "Filtros (N)" expansível
 * + chips dos filtros ativos visíveis sem expandir.
 *
 * Substitui a barra antiga de 8 dropdowns sempre visíveis (que tomava
 * 2 linhas inteiras). O grid completo só aparece sob demanda.
 *
 * Sort também fica dentro do painel expansível — evita poluir a barra
 * principal pra um caso menos frequente.
 */
export function PropertyFilters() {
  const { filters, setFilters, properties } = useProperties();
  const [expanded, setExpanded] = useState(false);

  // Filtros interdependentes — só mostra opções que casam com o resto
  // do que está selecionado. Mantém o mesmo helper que a versão antiga.
  const filterExcept = (
    exclude:
      | "tipoImovel"
      | "proprietarioPapel"
      | "estado"
      | "cidade"
      | "bairro"
      | "status"
      | "validado",
  ) => {
    return properties.filter((p) => {
      if (exclude !== "tipoImovel" && filters.tipoImovel && p.tipo_imovel !== filters.tipoImovel) return false;
      if (exclude !== "proprietarioPapel" && filters.proprietarioPapel) {
        if (filters.proprietarioPapel === "__empty__") {
          if (p.proprietario_papel) return false;
        } else if (p.proprietario_papel !== filters.proprietarioPapel) return false;
      }
      if (exclude !== "estado" && filters.estado && p.estado !== filters.estado) return false;
      if (exclude !== "cidade" && filters.cidade && p.cidade !== filters.cidade) return false;
      if (exclude !== "bairro" && filters.bairro && p.bairro !== filters.bairro) return false;
      if (exclude !== "status" && filters.status !== "all") {
        if (filters.status === "vendido" && !p.vendido) return false;
        if (filters.status === "alugado" && !p.alugado) return false;
        if (filters.status === "disponivel" && (p.vendido || p.alugado)) return false;
      }
      if (exclude !== "validado" && filters.validado !== "all") {
        if (filters.validado === "sim" && !p.validado) return false;
        if (filters.validado === "nao" && p.validado) return false;
      }
      return true;
    });
  };

  const estados = [...new Set(filterExcept("estado").map((p) => p.estado).filter(Boolean))].sort();
  const cidades = [...new Set(filterExcept("cidade").map((p) => p.cidade).filter(Boolean))].sort();
  const bairros = [...new Set(filterExcept("bairro").map((p) => p.bairro).filter(Boolean))].sort();
  const tiposDisponiveis = new Set(filterExcept("tipoImovel").map((p) => p.tipo_imovel).filter(Boolean));

  const propsForOwner = filterExcept("proprietarioPapel");
  const proprietariosPapel = [...new Set(propsForOwner.map((p) => p.proprietario_papel).filter(Boolean))].sort();
  const hasEmptyProprietarioPapel = propsForOwner.some((p) => !p.proprietario_papel);

  const propsForStatus = filterExcept("status");
  const statusDisponiveis = new Set<string>();
  for (const p of propsForStatus) {
    if (p.vendido) statusDisponiveis.add("vendido");
    if (p.alugado) statusDisponiveis.add("alugado");
    if (!p.vendido && !p.alugado) statusDisponiveis.add("disponivel");
  }

  const propsForValidado = filterExcept("validado");
  const validadoDisponiveis = new Set<string>();
  for (const p of propsForValidado) {
    validadoDisponiveis.add(p.validado ? "sim" : "nao");
  }

  const tiposImovelFiltrados = TIPOS_IMOVEL.filter(
    (t) => tiposDisponiveis.has(t.value) || filters.tipoImovel === t.value,
  );

  // Quais filtros estão ativos (sem contar search e sort que têm UI própria)
  const activeChips = computeActiveChips(filters);
  const advancedActiveCount = activeChips.length;

  const handleClear = () => setFilters({ ...INITIAL_FILTERS });

  const removeChip = (key: keyof PropertyFiltersType) => {
    if (key === "status" || key === "validado") {
      setFilters({ ...filters, [key]: "all" });
    } else {
      setFilters({ ...filters, [key]: "" });
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
      {/* ── linha 1: busca prominent + Filtros + Limpar ─────────────── */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por endereço, proprietário, matrícula…"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="h-9 pl-9"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setExpanded((v) => !v)}
          className="h-9 shrink-0 gap-1.5"
        >
          <Filter className="h-4 w-4" />
          <span className="hidden sm:inline">Filtros</span>
          {advancedActiveCount > 0 ? (
            <Badge variant="default" className="h-5 px-1.5 text-nano">
              {advancedActiveCount}
            </Badge>
          ) : null}
          {expanded ? (
            <ChevronUp className="h-3.5 w-3.5 opacity-60" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          )}
        </Button>
        {(advancedActiveCount > 0 || filters.search) ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="h-9 shrink-0 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="mr-1 h-3 w-3" />
            <span className="hidden sm:inline">Limpar</span>
          </Button>
        ) : null}
      </div>

      {/* ── chips dos filtros ativos (sempre visível se houver) ─────── */}
      {advancedActiveCount > 0 ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => removeChip(chip.key)}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 text-label hover:bg-secondary/80"
            >
              <span className="text-muted-foreground">{chip.label}:</span>
              <span className="font-medium">{chip.value}</span>
              <X className="h-3 w-3" />
            </button>
          ))}
        </div>
      ) : null}

      {/* ── painel expandido: grid completo + sort ──────────────────── */}
      {expanded ? (
        <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <FilterSelect
              label="Tipo"
              value={filters.tipoImovel || "all"}
              onChange={(v) =>
                setFilters({ ...filters, tipoImovel: v === "all" ? "" : v })
              }
              options={[
                { value: "all", label: "Todos" },
                ...tiposImovelFiltrados,
              ]}
            />
            {(proprietariosPapel.length > 0 || hasEmptyProprietarioPapel) ? (
              <FilterSelect
                label="Proprietário"
                value={filters.proprietarioPapel || "all"}
                onChange={(v) =>
                  setFilters({
                    ...filters,
                    proprietarioPapel: v === "all" ? "" : v,
                  })
                }
                options={[
                  { value: "all", label: "Todos" },
                  ...(hasEmptyProprietarioPapel
                    ? [{ value: "__empty__", label: "Não preenchido" }]
                    : []),
                  ...proprietariosPapel.map((p) => ({ value: p, label: p })),
                ]}
              />
            ) : null}
            <FilterSelect
              label="Estado"
              value={filters.estado || "all"}
              onChange={(v) =>
                setFilters({ ...filters, estado: v === "all" ? "" : v })
              }
              options={[
                { value: "all", label: "Todos" },
                ...estados.map((uf) => ({ value: uf, label: uf })),
              ]}
            />
            <FilterSelect
              label="Cidade"
              value={filters.cidade || "all"}
              onChange={(v) =>
                setFilters({ ...filters, cidade: v === "all" ? "" : v })
              }
              options={[
                { value: "all", label: "Todas" },
                ...cidades.map((c) => ({ value: c, label: c })),
              ]}
            />
            <FilterSelect
              label="Bairro"
              value={filters.bairro || "all"}
              onChange={(v) =>
                setFilters({ ...filters, bairro: v === "all" ? "" : v })
              }
              options={[
                { value: "all", label: "Todos" },
                ...bairros.map((b) => ({ value: b, label: b })),
              ]}
            />
            <FilterSelect
              label="Status"
              value={filters.status}
              onChange={(v) =>
                setFilters({
                  ...filters,
                  status: v as PropertyFiltersType["status"],
                })
              }
              options={[
                { value: "all", label: "Todos" },
                ...(statusDisponiveis.has("disponivel")
                  ? [{ value: "disponivel", label: "Disponível" }]
                  : []),
                ...(statusDisponiveis.has("alugado")
                  ? [{ value: "alugado", label: "Alugado" }]
                  : []),
                ...(statusDisponiveis.has("vendido")
                  ? [{ value: "vendido", label: "Vendido" }]
                  : []),
              ]}
            />
            <FilterSelect
              label="Validação"
              value={filters.validado}
              onChange={(v) =>
                setFilters({
                  ...filters,
                  validado: v as PropertyFiltersType["validado"],
                })
              }
              options={[
                { value: "all", label: "Todos" },
                ...(validadoDisponiveis.has("sim")
                  ? [{ value: "sim", label: "Validado" }]
                  : []),
                ...(validadoDisponiveis.has("nao")
                  ? [{ value: "nao", label: "Pendente" }]
                  : []),
              ]}
            />
          </div>

          {/* Sort fica no rodapé do painel expandido */}
          <div className="flex flex-wrap items-center gap-2 border-t border-border/40 pt-2">
            <span className="text-label uppercase tracking-wide text-muted-foreground">
              <ArrowDownUp className="mr-1 inline h-3 w-3" />
              Ordenar:
            </span>
            <Select
              value={filters.sortField}
              onValueChange={(v) =>
                setFilters({ ...filters, sortField: v as SortField })
              }
            >
              <SelectTrigger className="h-8 w-[180px] text-label">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setFilters({
                  ...filters,
                  sortOrder: filters.sortOrder === "asc" ? "desc" : "asc",
                })
              }
              className="h-8 text-label"
            >
              {filters.sortOrder === "asc" ? (
                <>
                  <ChevronUp className="mr-1 h-3 w-3" /> Crescente
                </>
              ) : (
                <>
                  <ChevronDown className="mr-1 h-3 w-3" /> Decrescente
                </>
              )}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─── chips de filtros ativos ─────────────────────────────────────────

interface ActiveChip {
  key: keyof PropertyFiltersType;
  label: string;
  value: string;
}

const STATUS_LABELS: Record<string, string> = {
  alugado: "Alugado",
  disponivel: "Disponível",
  vendido: "Vendido",
};

const VALIDADO_LABELS: Record<string, string> = {
  sim: "Validado",
  nao: "Pendente",
};

function computeActiveChips(filters: PropertyFiltersType): ActiveChip[] {
  const chips: ActiveChip[] = [];
  if (filters.tipoImovel) {
    const tipo = TIPOS_IMOVEL.find((t) => t.value === filters.tipoImovel);
    chips.push({
      key: "tipoImovel",
      label: "Tipo",
      value: tipo?.label ?? filters.tipoImovel,
    });
  }
  if (filters.proprietarioPapel) {
    chips.push({
      key: "proprietarioPapel",
      label: "Proprietário",
      value:
        filters.proprietarioPapel === "__empty__"
          ? "Não preenchido"
          : filters.proprietarioPapel,
    });
  }
  if (filters.estado) {
    chips.push({ key: "estado", label: "Estado", value: filters.estado });
  }
  if (filters.cidade) {
    chips.push({ key: "cidade", label: "Cidade", value: filters.cidade });
  }
  if (filters.bairro) {
    chips.push({ key: "bairro", label: "Bairro", value: filters.bairro });
  }
  if (filters.status !== "all") {
    chips.push({
      key: "status",
      label: "Status",
      value: STATUS_LABELS[filters.status] ?? filters.status,
    });
  }
  if (filters.validado !== "all") {
    chips.push({
      key: "validado",
      label: "Validação",
      value: VALIDADO_LABELS[filters.validado] ?? filters.validado,
    });
  }
  return chips;
}

// ─── helpers internos ────────────────────────────────────────────────

interface FilterSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}

function FilterSelect({ label, value, onChange, options }: FilterSelectProps) {
  return (
    <div className="space-y-1">
      <label className="text-meta uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-label">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
