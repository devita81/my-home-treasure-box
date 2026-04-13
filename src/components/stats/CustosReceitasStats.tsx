import { useMemo, useState } from 'react';
import { useProperties } from '@/contexts/PropertyContext';
import { Property } from '@/types/property';
import { DollarSign, Home, TrendingUp, TrendingDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ExportButtons } from '@/components/ui/export-buttons';
import { useExportData } from '@/hooks/useExportData';

export function CustosReceitasStats() {
  const { properties } = useProperties();
  const { exportToExcel, exportToPDF, simpleColumns } = useExportData();
  const [dialog, setDialog] = useState<{ open: boolean; title: string; properties: Property[] }>({
    open: false, title: '', properties: [],
  });

  const alugados = useMemo(() => properties.filter((p) => p.alugado), [properties]);
  const naoAlugados = useMemo(() => properties.filter((p) => !p.alugado), [properties]);

  const calc = (list: Property[]) => {
    const count = list.length;
    const aluguel = list.reduce((s, p) => s + (p.valor_aluguel ?? 0), 0);
    const condominio = list.reduce((s, p) => s + (p.valor_condominio ?? 0), 0);
    const iptuMes = list.reduce((s, p) => s + (p.iptu_value ?? 0) / 12, 0);
    const taxaAdm = list.reduce((s, p) => s + (p.taxa_administracao ?? 0), 0);
    const liquido = aluguel - condominio - iptuMes - taxaAdm;
    return { count, aluguel, condominio, iptuMes, taxaAdm, liquido };
  };

  const statsAlugados = useMemo(() => calc(alugados), [alugados]);
  const statsNaoAlugados = useMemo(() => calc(naoAlugados), [naoAlugados]);

  const fmt = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const fmtFull = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-primary" />
          <h3 className="font-display text-lg font-semibold">Custos e Receitas</h3>
        </div>

        <div className="rounded-lg border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Categoria</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Qtd</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Aluguel/mês</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Condomínio/mês</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">IPTU/mês</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Taxa Adm/mês</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Líquido/mês</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'Imóveis Alugados', icon: TrendingUp, iconColor: 'text-green-600', data: statsAlugados, list: alugados },
                { label: 'Imóveis Não Alugados', icon: TrendingDown, iconColor: 'text-muted-foreground', data: statsNaoAlugados, list: naoAlugados },
              ].map((row) => (
                <tr
                  key={row.label}
                  className="border-b last:border-b-0 hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => openDrillDown(row.label, row.list)}
                >
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <row.icon className={`h-4 w-4 ${row.iconColor}`} />
                      <span className="font-semibold">{row.label}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right font-medium">{row.data.count}</td>
                  <td className="px-3 py-2.5 text-right font-medium">{fmt(row.data.aluguel)}</td>
                  <td className="px-3 py-2.5 text-right font-medium">{fmt(row.data.condominio)}</td>
                  <td className="px-3 py-2.5 text-right font-medium">{fmt(row.data.iptuMes)}</td>
                  <td className="px-3 py-2.5 text-right font-medium">{fmt(row.data.taxaAdm)}</td>
                  <td className={`px-3 py-2.5 text-right font-bold ${row.data.liquido >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {fmt(row.data.liquido)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
