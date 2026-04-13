import { useMemo } from 'react';
import { useProperties } from '@/contexts/PropertyContext';
import { DollarSign, Home, TrendingUp, TrendingDown } from 'lucide-react';

export function CustosReceitasStats() {
  const { properties } = useProperties();

  const stats = useMemo(() => {
    const alugados = properties.filter((p) => p.alugado);
    const naoAlugados = properties.filter((p) => !p.alugado);

    const calc = (list: typeof properties) => {
      const count = list.length;
      const aluguel = list.reduce((s, p) => s + (p.valor_aluguel ?? 0), 0);
      const condominio = list.reduce((s, p) => s + (p.valor_condominio ?? 0), 0);
      const iptuMes = list.reduce((s, p) => s + (p.iptu_value ?? 0) / 12, 0);
      const taxaAdm = list.reduce((s, p) => s + (p.taxa_administracao ?? 0), 0);
      const liquido = aluguel - condominio - iptuMes - taxaAdm;
      return { count, aluguel, condominio, iptuMes, taxaAdm, liquido };
    };

    return {
      alugados: calc(alugados),
      naoAlugados: calc(naoAlugados),
    };
  }, [properties]);

  const fmt = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const Row = ({ label, icon: Icon, data, iconColor }: {
    label: string;
    icon: typeof Home;
    data: typeof stats.alugados;
    iconColor: string;
  }) => (
    <div className="rounded-lg border bg-card p-4">
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
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <DollarSign className="h-5 w-5 text-primary" />
        <h3 className="font-display text-lg font-semibold">Custos e Receitas</h3>
      </div>
      <Row label="Imóveis Alugados" icon={TrendingUp} data={stats.alugados} iconColor="text-green-600" />
      <Row label="Imóveis Não Alugados" icon={TrendingDown} data={stats.naoAlugados} iconColor="text-muted-foreground" />
    </div>
  );
}
