import { Header } from '@/components/layout/Header';
import { useProperties } from '@/contexts/PropertyContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import { 
  TrendingUp, 
  Home, 
  MapPin, 
  DollarSign,
  Key,
  FileCheck
} from 'lucide-react';

const Analytics = () => {
  const { properties } = useProperties();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
    }).format(value);
  };

  // Status Distribution
  const statusData = [
    { name: 'Disponível', value: properties.filter(p => !p.vendido && !p.alugado).length, color: 'hsl(145, 50%, 40%)' },
    { name: 'Alugado', value: properties.filter(p => p.alugado).length, color: 'hsl(200, 80%, 50%)' },
    { name: 'Vendido', value: properties.filter(p => p.vendido).length, color: 'hsl(0, 72%, 51%)' },
  ].filter(d => d.value > 0);

  // Properties by State
  const stateData = properties.reduce((acc, property) => {
    const existing = acc.find(item => item.estado === property.estado);
    if (existing) {
      existing.quantidade += 1;
      existing.valor += property.market_value;
    } else {
      acc.push({ 
        estado: property.estado, 
        quantidade: 1, 
        valor: property.market_value 
      });
    }
    return acc;
  }, [] as { estado: string; quantidade: number; valor: number }[]);

  // Validation Status
  const validationData = [
    { name: 'Validado', value: properties.filter(p => p.validado).length, color: 'hsl(145, 50%, 40%)' },
    { name: 'Pendente', value: properties.filter(p => !p.validado).length, color: 'hsl(38, 92%, 50%)' },
  ].filter(d => d.value > 0);

  // IPTU Status
  const iptuData = [
    { name: 'Pago', value: properties.filter(p => p.iptu_pago).length, color: 'hsl(145, 50%, 40%)' },
    { name: 'Pendente', value: properties.filter(p => !p.iptu_pago).length, color: 'hsl(0, 72%, 51%)' },
  ].filter(d => d.value > 0);

  // Summary Stats
  const totalMarketValue = properties.reduce((acc, p) => acc + p.market_value, 0);
  const totalDeclaredValue = properties.reduce((acc, p) => acc + p.declared_value, 0);
  const totalMonthlyRent = properties
    .filter(p => p.alugado && p.valor_aluguel)
    .reduce((acc, p) => acc + (p.valor_aluguel || 0), 0);
  const totalIptu = properties.reduce((acc, p) => acc + p.iptu_value, 0);
  const pendingIptuValue = properties
    .filter(p => !p.iptu_pago)
    .reduce((acc, p) => acc + p.iptu_value, 0);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8 space-y-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold">Analytics</h1>
            <p className="text-muted-foreground">Visão geral da sua coleção de imóveis</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="stat-card">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <Home className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total de Imóveis</p>
                  <p className="text-2xl font-bold font-display">{properties.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
                  <DollarSign className="h-6 w-6 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Valor de Mercado</p>
                  <p className="text-2xl font-bold font-display">{formatCurrency(totalMarketValue)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-info/10">
                  <Key className="h-6 w-6 text-info" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Renda Mensal</p>
                  <p className="text-2xl font-bold font-display">{formatCurrency(totalMonthlyRent)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning/10">
                  <FileCheck className="h-6 w-6 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">IPTU Pendente</p>
                  <p className="text-2xl font-bold font-display">{formatCurrency(pendingIptuValue)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Status Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Home className="h-5 w-5 text-primary" />
                Distribuição por Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Properties by State */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                Imóveis por Estado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stateData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="estado" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="quantidade" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Second Charts Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Validation Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-primary" />
                Status de Validação
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={validationData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {validationData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* IPTU Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                Status do IPTU
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={iptuData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {iptuData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Value Comparison */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Comparativo de Valores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-4 bg-secondary rounded-xl">
                <p className="text-sm text-muted-foreground mb-1">Valor Declarado Total</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(totalDeclaredValue)}</p>
              </div>
              <div className="p-4 bg-primary/10 rounded-xl">
                <p className="text-sm text-muted-foreground mb-1">Valor de Mercado Total</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(totalMarketValue)}</p>
              </div>
              <div className="p-4 bg-success/10 rounded-xl">
                <p className="text-sm text-muted-foreground mb-1">Valorização</p>
                <p className="text-2xl font-bold text-success">
                  +{formatCurrency(totalMarketValue - totalDeclaredValue)}
                </p>
                <p className="text-xs text-muted-foreground">
                  ({((totalMarketValue - totalDeclaredValue) / totalDeclaredValue * 100).toFixed(1)}%)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Analytics;
