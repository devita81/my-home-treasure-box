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

  const getAddress = (p: Property) =>
    `${p.rua}${p.numero ? ', ' + p.numero : ''}${p.apartamento ? ' - Ap ' + p.apartamento : ''} - ${p.bairro}, ${p.cidade}`;

  const openDrillDown = (title: string, list: Property[]) => {
    setDialog({ open: true, title, properties: list });
  };

  const Row = ({ label, icon: Icon, data, iconColor, propsList }: {
    label: string;
    icon: typeof Home;
    data: ReturnType<typeof calc>;
    iconColor: string;
    propsList: Property[];
  }) => (
    <div
      className="rounded-lg border bg-card p-4 cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all"
      onClick={() => openDrillDown(label, propsList)}
    >
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`h-5 w-5 ${iconColor}`} />
        <h4 className="font-semibold text-sm">{label}</h4>
        <span className="ml-auto text-xs bg-muted px-2 py-0.5 rounded-full font-medium">
          {data.count} {data.count === 1 ? 'imóvel' : 'imóveis'}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Aluguel/mês</p>
          <p className="text-sm font-semibold text-foreground">{fmt(data.aluguel)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Condomínio/mês</p>
          <p className="text-sm font-semibold text-foreground">{fmt(data.condominio)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">IPTU/mês</p>
          <p className="text-sm font-semibold text-foreground">{fmt(data.iptuMes)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Taxa Adm/mês</p>
          <p className="text-sm font-semibold text-foreground">{fmt(data.taxaAdm)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Líquido/mês</p>
          <p className={`text-sm font-bold ${data.liquido >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {fmt(data.liquido)}
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-primary" />
          <h3 className="font-display text-lg font-semibold">Custos e Receitas</h3>
        </div>
        <Row label="Imóveis Alugados" icon={TrendingUp} data={statsAlugados} iconColor="text-green-600" propsList={alugados} />
        <Row label="Imóveis Não Alugados" icon={TrendingDown} data={statsNaoAlugados} iconColor="text-muted-foreground" propsList={naoAlugados} />
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
