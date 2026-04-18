import { useMemo, useState } from 'react';
import { useProperties } from '@/contexts/PropertyContext';
import { Property } from '@/types/property';
import { DollarSign, TrendingUp, TrendingDown, ChevronDown, ChevronUp, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ExportButtons } from '@/components/ui/export-buttons';
import { useExportData } from '@/hooks/useExportData';

interface GroupRow {
  cidade: string;
  tipo: string;
  count: number;
  aluguel: number;
  condominio: number;
  iptuMes: number;
  taxaAdm: number;
  liquido: number;
  properties: Property[];
}

interface CidadeGroup {
  cidade: string;
  items: GroupRow[];
}

const tipoLabels: Record<string, string> = {
  apartamento: 'Apartamentos',
  casa: 'Casas',
  terreno: 'Terrenos',
  comercial: 'Comercial',
  rural: 'Rural',
  industrial: 'Industrial',
  conjunto_comercial: 'Conj. Comercial',
};

function buildGroups(list: Property[]): CidadeGroup[] {
  const map = new Map<string, GroupRow>();
  list.forEach((p) => {
    const cidade = p.cidade || 'Não informado';
    const tipo = p.tipo_imovel || 'Não informado';
    const key = `${cidade}-${tipo}`;
    if (!map.has(key)) {
      map.set(key, { cidade, tipo, count: 0, aluguel: 0, condominio: 0, iptuMes: 0, taxaAdm: 0, liquido: 0, properties: [] });
    }
    const g = map.get(key)!;
    g.count += 1;
    g.aluguel += p.valor_aluguel ?? 0;
    g.condominio += p.valor_condominio ?? 0;
    g.iptuMes += (p.iptu_value ?? 0) / 12;
    g.taxaAdm += p.taxa_administracao ?? 0;
    g.liquido = g.aluguel - g.condominio - g.iptuMes - g.taxaAdm;
    g.properties.push(p);
  });

  const cidadeMap = new Map<string, GroupRow[]>();
  Array.from(map.values()).forEach((g) => {
    if (!cidadeMap.has(g.cidade)) cidadeMap.set(g.cidade, []);
    cidadeMap.get(g.cidade)!.push(g);
  });

  return Array.from(cidadeMap.entries())
    .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
    .map(([cidade, items]) => ({
      cidade,
      items: items.sort((a, b) => b.count - a.count),
    }));
}

export function CustosReceitasStats() {
  const { properties } = useProperties();
  const { exportToExcel, exportToPDF, simpleColumns } = useExportData();
  const [dialog, setDialog] = useState<{ open: boolean; title: string; properties: Property[] }>({
    open: false, title: '', properties: [],
  });
  const [expanded, setExpanded] = useState(false);

  const alugados = useMemo(() => properties.filter((p) => p.alugado), [properties]);
  const naoAlugados = useMemo(() => properties.filter((p) => !p.alugado), [properties]);

  const groupsAlugados = useMemo(() => buildGroups(alugados), [alugados]);
  const groupsNaoAlugados = useMemo(() => buildGroups(naoAlugados), [naoAlugados]);

  const fmt = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const fmtFull = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

  const getAddress = (p: Property) =>
    `${p.rua}${p.numero ? ', ' + p.numero : ''}${p.apartamento ? ' - Ap ' + p.apartamento : ''} - ${p.bairro}, ${p.cidade}`;

  const openDrillDown = (title: string, list: Property[]) => {
    setDialog({ open: true, title, properties: list });
  };

  const CostTable = ({ label, icon: Icon, iconColor, groups }: {
    label: string;
    icon: typeof TrendingUp;
    iconColor: string;
    groups: CidadeGroup[];
  }) => {
    const allItems = groups.flatMap((g) => g.items);
    const totals = {
      count: allItems.reduce((s, g) => s + g.count, 0),
      aluguel: allItems.reduce((s, g) => s + g.aluguel, 0),
      condominio: allItems.reduce((s, g) => s + g.condominio, 0),
      iptuMes: allItems.reduce((s, g) => s + g.iptuMes, 0),
      taxaAdm: allItems.reduce((s, g) => s + g.taxaAdm, 0),
      liquido: allItems.reduce((s, g) => s + g.liquido, 0),
    };

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${iconColor}`} />
          <h4 className="text-sm font-semibold">{label}</h4>
        </div>

        {/* Mobile: Cards */}
        <div className="sm:hidden space-y-2">
          {groups.length === 0 ? (
            <div className="rounded-lg border bg-card p-4 text-center text-xs text-muted-foreground">Nenhum imóvel</div>
          ) : (
            <>
              {groups.map(({ cidade, items }) => (
                <div key={cidade} className="rounded-lg border bg-card overflow-hidden">
                  <div className="px-3 py-1.5 bg-muted/50 border-b">
                    <p className="text-[11px] font-semibold text-foreground">{cidade}</p>
                  </div>
                  {items.map((g) => (
                    <div
                      key={`${g.cidade}-${g.tipo}`}
                      onClick={() => openDrillDown(`${label} - ${cidade} - ${tipoLabels[g.tipo] || g.tipo}`, g.properties)}
                      className="px-3 py-2 border-b last:border-b-0 cursor-pointer active:bg-muted/30"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-medium capitalize">{tipoLabels[g.tipo] || g.tipo}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">{g.count} {g.count === 1 ? 'imóvel' : 'imóveis'}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px]">
                        <span className="text-muted-foreground">Aluguel</span>
                        <span className="text-right font-medium tabular-nums">{fmt(g.aluguel)}</span>
                        <span className="text-muted-foreground">Condomínio</span>
                        <span className="text-right font-medium tabular-nums">{fmt(g.condominio)}</span>
                        <span className="text-muted-foreground">IPTU/mês</span>
                        <span className="text-right font-medium tabular-nums">{fmt(g.iptuMes)}</span>
                        <span className="text-muted-foreground">Taxa Adm</span>
                        <span className="text-right font-medium tabular-nums">{fmt(g.taxaAdm)}</span>
                        <span className="text-muted-foreground font-semibold pt-1 border-t mt-1">Líquido</span>
                        <span className={`text-right font-bold tabular-nums pt-1 border-t mt-1 ${g.liquido >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(g.liquido)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
              <div className="rounded-lg border-2 bg-muted/40 px-3 py-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold">Subtotal</span>
                  <span className="text-[10px] font-mono">{totals.count} imóveis</span>
                </div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px]">
                  <span>Aluguel</span><span className="text-right font-medium tabular-nums">{fmt(totals.aluguel)}</span>
                  <span>Condomínio</span><span className="text-right font-medium tabular-nums">{fmt(totals.condominio)}</span>
                  <span>IPTU/mês</span><span className="text-right font-medium tabular-nums">{fmt(totals.iptuMes)}</span>
                  <span>Taxa Adm</span><span className="text-right font-medium tabular-nums">{fmt(totals.taxaAdm)}</span>
                  <span className="font-semibold pt-1 border-t mt-1">Líquido</span>
                  <span className={`text-right font-bold tabular-nums pt-1 border-t mt-1 ${totals.liquido >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(totals.liquido)}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Desktop: Tabela */}
        <div className="hidden sm:block rounded-lg border bg-card overflow-hidden scroll-x-fade">
          <div className="overflow-x-auto scroll-x-visible">
            <table className="w-full text-xs sm:text-sm min-w-[760px]">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-2 sm:px-3 py-2 text-[10px] sm:text-xs font-semibold text-muted-foreground">Cidade</th>
                  <th className="text-left px-2 sm:px-3 py-2 text-[10px] sm:text-xs font-semibold text-muted-foreground">Tipo</th>
                  <th className="text-right px-2 sm:px-3 py-2 text-[10px] sm:text-xs font-semibold text-muted-foreground">Qtd</th>
                  <th className="text-right px-2 sm:px-3 py-2 text-[10px] sm:text-xs font-semibold text-muted-foreground">Aluguel/mês</th>
                  <th className="text-right px-2 sm:px-3 py-2 text-[10px] sm:text-xs font-semibold text-muted-foreground">Condomínio/mês</th>
                  <th className="text-right px-2 sm:px-3 py-2 text-[10px] sm:text-xs font-semibold text-muted-foreground">IPTU/mês</th>
                  <th className="text-right px-2 sm:px-3 py-2 text-[10px] sm:text-xs font-semibold text-muted-foreground">Taxa Adm/mês</th>
                  <th className="text-right px-2 sm:px-3 py-2 text-[10px] sm:text-xs font-semibold text-muted-foreground">Líquido/mês</th>
                </tr>
              </thead>
              <tbody>
                {groups.length === 0 ? (
                  <tr><td colSpan={8} className="px-3 py-4 text-center text-muted-foreground text-xs">Nenhum imóvel</td></tr>
                ) : (
                  <>
                    {groups.map(({ cidade, items }) =>
                      items.map((g, idx) => (
                        <tr
                          key={`${g.cidade}-${g.tipo}`}
                          className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                          onClick={() => openDrillDown(`${label} - ${cidade} - ${tipoLabels[g.tipo] || g.tipo}`, g.properties)}
                        >
                          {idx === 0 && (
                            <td className="px-2 sm:px-3 py-2 font-semibold text-foreground" rowSpan={items.length}>
                              {cidade}
                            </td>
                          )}
                          <td className="px-2 sm:px-3 py-2 text-muted-foreground capitalize">{tipoLabels[g.tipo] || g.tipo}</td>
                          <td className="px-2 sm:px-3 py-2 text-right font-medium">{g.count}</td>
                          <td className="px-2 sm:px-3 py-2 text-right font-medium whitespace-nowrap">{fmt(g.aluguel)}</td>
                          <td className="px-2 sm:px-3 py-2 text-right font-medium whitespace-nowrap">{fmt(g.condominio)}</td>
                          <td className="px-2 sm:px-3 py-2 text-right font-medium whitespace-nowrap">{fmt(g.iptuMes)}</td>
                          <td className="px-2 sm:px-3 py-2 text-right font-medium whitespace-nowrap">{fmt(g.taxaAdm)}</td>
                          <td className={`px-2 sm:px-3 py-2 text-right font-bold whitespace-nowrap ${g.liquido >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {fmt(g.liquido)}
                          </td>
                        </tr>
                      ))
                    )}
                    <tr className="bg-muted/50 font-bold border-t-2">
                      <td className="px-2 sm:px-3 py-2" colSpan={2}>Subtotal</td>
                      <td className="px-2 sm:px-3 py-2 text-right">{totals.count}</td>
                      <td className="px-2 sm:px-3 py-2 text-right whitespace-nowrap">{fmt(totals.aluguel)}</td>
                      <td className="px-2 sm:px-3 py-2 text-right whitespace-nowrap">{fmt(totals.condominio)}</td>
                      <td className="px-2 sm:px-3 py-2 text-right whitespace-nowrap">{fmt(totals.iptuMes)}</td>
                      <td className="px-2 sm:px-3 py-2 text-right whitespace-nowrap">{fmt(totals.taxaAdm)}</td>
                      <td className={`px-2 sm:px-3 py-2 text-right whitespace-nowrap ${totals.liquido >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {fmt(totals.liquido)}
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <Collapsible open={expanded} onOpenChange={setExpanded} className="space-y-4">
        <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 rounded-md border bg-card hover:bg-muted/50 transition-colors group">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground tracking-tight">Custos e Receitas</h3>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground group-hover:text-foreground transition-colors">
            <span className="text-xs font-medium">{expanded ? 'Recolher' : 'Expandir'}</span>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up overflow-hidden">
          <CostTable label="Imóveis Alugados" icon={TrendingUp} iconColor="text-green-600" groups={groupsAlugados} />
          <CostTable label="Imóveis Não Alugados" icon={TrendingDown} iconColor="text-muted-foreground" groups={groupsNaoAlugados} />
        </CollapsibleContent>
      </Collapsible>

      <Dialog open={dialog.open} onOpenChange={(open) => setDialog((prev) => ({ ...prev, open }))}>
        <DialogContent className="!grid-cols-1 w-[100vw] max-w-[100vw] sm:max-w-4xl sm:w-[calc(100vw-2rem)] h-[100dvh] sm:h-auto sm:max-h-[85vh] overflow-hidden flex flex-col p-0 gap-0 rounded-none sm:rounded-lg border-0 sm:border left-0 right-0 translate-x-0 sm:left-[50%] sm:translate-x-[-50%] top-0 translate-y-0 sm:top-[50%] sm:translate-y-[-50%] [&>button.absolute]:hidden sm:[&>button.absolute]:flex sm:[&>button.absolute]:top-4 sm:[&>button.absolute]:right-4">
          <DialogHeader
            className="px-2 sm:px-6 pt-2 sm:pt-6 pb-2 sm:pb-4 border-b shrink-0 bg-background"
            style={{ paddingTop: 'max(0.5rem, calc(env(safe-area-inset-top) + 0.25rem))' }}
          >
            {/* Mobile: app-bar style */}
            <div className="flex sm:hidden items-center gap-2">
              <button
                onClick={() => setDialog((prev) => ({ ...prev, open: false }))}
                className="flex items-center justify-center h-10 w-10 rounded-full hover:bg-muted active:bg-muted/80 text-foreground shrink-0"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
              <DialogTitle className="text-base font-semibold flex-1 text-center truncate px-1">{dialog.title}</DialogTitle>
              <div className="shrink-0">
                <ExportButtons
                  onExportExcel={() => exportToExcel(dialog.properties, dialog.title, simpleColumns)}
                  onExportPDF={() => exportToPDF(dialog.properties, dialog.title, undefined, simpleColumns)}
                />
              </div>
            </div>
            {/* Desktop */}
            <DialogTitle className="hidden sm:block text-base font-semibold pr-10">{dialog.title}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-6 py-3 sm:py-4">
            <div className="hidden sm:flex items-center justify-end mb-2">
              <ExportButtons
                onExportExcel={() => exportToExcel(dialog.properties, dialog.title, simpleColumns)}
                onExportPDF={() => exportToPDF(dialog.properties, dialog.title, undefined, simpleColumns)}
              />
            </div>

          {/* Mobile: dense cards (mesmo padrão do drill-down do Analytics) */}
          <div className="sm:hidden rounded-lg border border-slate-200 bg-white overflow-hidden">
            {dialog.properties.length === 0 ? (
              <div className="text-center text-slate-400 py-12 text-sm">Nenhum imóvel encontrado</div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {dialog.properties.map((p, index) => {
                  const tipoLabel = (() => {
                    const labels: Record<string, string> = {
                      apartamento: 'Apto',
                      casa: 'Casa',
                      terreno: 'Terreno',
                      conjunto_comercial: 'Conj. Com.',
                    };
                    return labels[p.tipo_imovel || ''] || p.tipo_imovel || '-';
                  })();
                  const addressParts = [p.rua];
                  if (p.numero) addressParts.push(p.numero);
                  if (p.apartamento) addressParts.push(`Apto ${p.apartamento}`);
                  const address = addressParts.join(', ');

                  return (
                    <li key={p.id} className={`p-3 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}`}>
                      <Link to={`/property/${p.id}`} className="block">
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="min-w-0 flex-1">
                            <p className="text-[12px] font-semibold text-slate-900 truncate" title={address}>
                              {address}
                            </p>
                            <p className="text-[10px] text-slate-500 truncate">
                              {tipoLabel} • {p.cidade} - {p.estado}
                            </p>
                          </div>
                          {p.alugado ? (
                            <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium">Alugado</span>
                          ) : (
                            <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">Vago</span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] font-mono tabular-nums text-slate-700">
                          <div className="flex justify-between"><span className="text-slate-500">Mercado</span><span className="font-semibold text-slate-900">{fmt(p.market_value || 0)}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Declar.</span><span>{fmt(p.declared_value)}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Aluguel</span><span>{fmt(p.valor_aluguel || 0)}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">IPTU</span><span>{fmt(p.iptu_value || 0)}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Condom.</span><span>{fmt(p.valor_condominio || 0)}</span></div>
                          <div />
                        </div>
                        {(p.numero_matricula || p.proprietario_matricula) && (
                          <div className="mt-1.5 pt-1.5 border-t border-slate-100 text-[9px] text-slate-500 truncate">
                            {p.numero_matricula && <span className="font-mono">Matr. {p.numero_matricula}</span>}
                            {p.numero_matricula && p.proprietario_matricula && <span> • </span>}
                            {p.proprietario_matricula && <span className="truncate">{p.proprietario_matricula}</span>}
                          </div>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Desktop: tabela */}
          <div className="hidden sm:block rounded-lg border bg-card overflow-hidden scroll-x-fade">
            <div className="overflow-x-auto scroll-x-visible">
              <table className="w-full text-xs sm:text-sm min-w-[680px]">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-2 sm:px-3 py-2 text-[10px] sm:text-xs font-semibold text-muted-foreground">Endereço</th>
                    <th className="text-right px-2 sm:px-3 py-2 text-[10px] sm:text-xs font-semibold text-muted-foreground">Aluguel</th>
                    <th className="text-right px-2 sm:px-3 py-2 text-[10px] sm:text-xs font-semibold text-muted-foreground">Condomínio</th>
                    <th className="text-right px-2 sm:px-3 py-2 text-[10px] sm:text-xs font-semibold text-muted-foreground">IPTU/mês</th>
                    <th className="text-right px-2 sm:px-3 py-2 text-[10px] sm:text-xs font-semibold text-muted-foreground">Taxa Adm</th>
                    <th className="text-right px-2 sm:px-3 py-2 text-[10px] sm:text-xs font-semibold text-muted-foreground">Líquido</th>
                  </tr>
                </thead>
                <tbody>
                  {dialog.properties.map((p) => {
                    const iptuMes = (p.iptu_value ?? 0) / 12;
                    const liquido = (p.valor_aluguel ?? 0) - (p.valor_condominio ?? 0) - iptuMes - (p.taxa_administracao ?? 0);
                    return (
                      <tr
                        key={p.id}
                        className="border-b last:border-b-0 hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => window.location.href = `/property/${p.id}`}
                      >
                        <td className="px-2 sm:px-3 py-2 sm:py-2.5">
                          <Link to={`/property/${p.id}`} className="hover:text-primary transition-colors">
                            <p className="font-medium text-xs sm:text-sm text-foreground">
                              {p.rua}{p.numero ? `, ${p.numero}` : ''}{p.apartamento ? ` – Ap ${p.apartamento}` : ''}
                            </p>
                            <p className="text-[10px] sm:text-xs text-muted-foreground">{p.bairro}, {p.cidade}</p>
                          </Link>
                        </td>
                        <td className="px-2 sm:px-3 py-2 sm:py-2.5 text-right font-medium whitespace-nowrap">{fmtFull(p.valor_aluguel ?? 0)}</td>
                        <td className="px-2 sm:px-3 py-2 sm:py-2.5 text-right font-medium whitespace-nowrap">{fmtFull(p.valor_condominio ?? 0)}</td>
                        <td className="px-2 sm:px-3 py-2 sm:py-2.5 text-right font-medium whitespace-nowrap">{fmtFull(iptuMes)}</td>
                        <td className="px-2 sm:px-3 py-2 sm:py-2.5 text-right font-medium whitespace-nowrap">{fmtFull(p.taxa_administracao ?? 0)}</td>
                        <td className={`px-2 sm:px-3 py-2 sm:py-2.5 text-right font-bold whitespace-nowrap ${liquido >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {fmtFull(liquido)}
                        </td>
                      </tr>
                    );
                  })}
                  {dialog.properties.length > 1 && (() => {
                    const totAluguel = dialog.properties.reduce((s, p) => s + (p.valor_aluguel ?? 0), 0);
                    const totCond = dialog.properties.reduce((s, p) => s + (p.valor_condominio ?? 0), 0);
                    const totIptu = dialog.properties.reduce((s, p) => s + ((p.iptu_value ?? 0) / 12), 0);
                    const totAdm = dialog.properties.reduce((s, p) => s + (p.taxa_administracao ?? 0), 0);
                    const totLiq = totAluguel - totCond - totIptu - totAdm;
                    return (
                      <tr className="bg-muted/50 font-bold border-t-2">
                        <td className="px-2 sm:px-3 py-2">Total ({dialog.properties.length} imóveis)</td>
                        <td className="px-2 sm:px-3 py-2 text-right whitespace-nowrap">{fmtFull(totAluguel)}</td>
                        <td className="px-2 sm:px-3 py-2 text-right whitespace-nowrap">{fmtFull(totCond)}</td>
                        <td className="px-2 sm:px-3 py-2 text-right whitespace-nowrap">{fmtFull(totIptu)}</td>
                        <td className="px-2 sm:px-3 py-2 text-right whitespace-nowrap">{fmtFull(totAdm)}</td>
                        <td className={`px-2 sm:px-3 py-2 text-right whitespace-nowrap ${totLiq >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmtFull(totLiq)}</td>
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
            </div>
          </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
