import { useMemo, useState } from 'react';
import { useProperties } from '@/contexts/PropertyContext';
import { Property } from '@/types/property';
import { DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  }) => (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${iconColor}`} />
        <h4 className="text-sm font-semibold">{label}</h4>
      </div>
      <div className="rounded-lg border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Cidade</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Tipo</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Qtd</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Aluguel/mês</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Condomínio/mês</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">IPTU/mês</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Taxa Adm/mês</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Líquido/mês</th>
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-4 text-center text-muted-foreground text-xs">Nenhum imóvel</td></tr>
            ) : (
              groups.map(({ cidade, items }) =>
                items.map((g, idx) => (
                  <tr
                    key={`${g.cidade}-${g.tipo}`}
                    className="border-b last:border-b-0 hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => openDrillDown(`${label} - ${cidade} - ${tipoLabels[g.tipo] || g.tipo}`, g.properties)}
                  >
                    {idx === 0 && (
                      <td className="px-3 py-2 font-semibold text-foreground" rowSpan={items.length}>
                        {cidade}
                      </td>
                    )}
                    <td className="px-3 py-2 text-muted-foreground capitalize">{tipoLabels[g.tipo] || g.tipo}</td>
                    <td className="px-3 py-2 text-right font-medium">{g.count}</td>
                    <td className="px-3 py-2 text-right font-medium">{fmt(g.aluguel)}</td>
                    <td className="px-3 py-2 text-right font-medium">{fmt(g.condominio)}</td>
                    <td className="px-3 py-2 text-right font-medium">{fmt(g.iptuMes)}</td>
                    <td className="px-3 py-2 text-right font-medium">{fmt(g.taxaAdm)}</td>
                    <td className={`px-3 py-2 text-right font-bold ${g.liquido >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {fmt(g.liquido)}
                    </td>
                  </tr>
                ))
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-primary" />
          <h3 className="font-display text-lg font-semibold">Custos e Receitas</h3>
        </div>
        <CostTable label="Imóveis Alugados" icon={TrendingUp} iconColor="text-green-600" groups={groupsAlugados} />
        <CostTable label="Imóveis Não Alugados" icon={TrendingDown} iconColor="text-muted-foreground" groups={groupsNaoAlugados} />
      </div>

      <Dialog open={dialog.open} onOpenChange={(open) => setDialog((prev) => ({ ...prev, open }))}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>{dialog.title}</DialogTitle>
              <ExportButtons
                onExportExcel={() => exportToExcel(dialog.properties, dialog.title, simpleColumns)}
                onExportPDF={() => exportToPDF(dialog.properties, dialog.title, undefined, simpleColumns)}
              />
            </div>
          </DialogHeader>

          <div className="space-y-2 mt-2">
            {dialog.properties.map((p) => {
              const iptuMes = (p.iptu_value ?? 0) / 12;
              const liquido = (p.valor_aluguel ?? 0) - (p.valor_condominio ?? 0) - iptuMes - (p.taxa_administracao ?? 0);
              return (
                <Link
                  key={p.id}
                  to={`/property/${p.id}`}
                  className="block rounded-lg border p-3 hover:border-primary/50 hover:bg-accent/30 transition-colors"
                >
                  <p className="text-sm font-semibold mb-1">{getAddress(p)}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Aluguel: </span>
                      <span className="font-medium">{fmtFull(p.valor_aluguel ?? 0)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Condomínio: </span>
                      <span className="font-medium">{fmtFull(p.valor_condominio ?? 0)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">IPTU/mês: </span>
                      <span className="font-medium">{fmtFull(iptuMes)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Taxa Adm: </span>
                      <span className="font-medium">{fmtFull(p.taxa_administracao ?? 0)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Líquido: </span>
                      <span className={`font-bold ${liquido >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {fmtFull(liquido)}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
