import { useState, useMemo, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, Database, Download, X, ArrowUpDown, ArrowUp, ArrowDown, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

interface ItbiResult {
  id: string;
  data_transacao: string | null;
  logradouro: string;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cep: string | null;
  sql_iptu: string | null;
  area_construida: number | null;
  valor_transacao: number | null;
  valor_venal: number | null;
}

const TIPOS = [
  { value: 'apartamento', label: 'Apartamento' },
  { value: 'casa', label: 'Casa' },
  { value: 'terreno', label: 'Terreno' },
  { value: 'comercial', label: 'Sala / Loja comercial' },
  { value: 'garagem', label: 'Garagem / Vaga' },
];

const fmtBRL = (v: number | null) =>
  v == null ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v));

const fmtDate = (s: string | null) => {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString('pt-BR');
  } catch {
    return s;
  }
};

export default function ItbiSearch() {
  const [tipos, setTipos] = useState<string[]>([]);
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [bairro, setBairro] = useState('');
  const [cep, setCep] = useState('');
  const [results, setResults] = useState<ItbiResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [sortField, setSortField] = useState<keyof ItbiResult>('data_transacao');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const hasAnyFilter = !!(logradouro.trim() || numero.trim() || bairro.trim() || cep.trim());

  const toggleSort = (field: keyof ItbiResult) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const sortedResults = useMemo(() => {
    const arr = [...results];
    arr.sort((a, b) => {
      const av = a[sortField];
      const bv = b[sortField];
      // nulls last
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;

      let cmp = 0;
      if (sortField === 'data_transacao') {
        cmp = new Date(av as string).getTime() - new Date(bv as string).getTime();
      } else if (
        sortField === 'valor_transacao' ||
        sortField === 'valor_venal' ||
        sortField === 'area_construida'
      ) {
        cmp = Number(av) - Number(bv);
      } else if (sortField === 'numero') {
        const an = parseInt(String(av).replace(/\D/g, ''), 10) || 0;
        const bn = parseInt(String(bv).replace(/\D/g, ''), 10) || 0;
        cmp = an - bn;
      } else {
        cmp = String(av).localeCompare(String(bv), 'pt-BR');
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [results, sortField, sortOrder]);

  const SortIcon = ({ field }: { field: keyof ItbiResult }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  // Auto-search com debounce conforme o usuário preenche
  useEffect(() => {
    if (!hasAnyFilter) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    const timer = setTimeout(() => {
      runSearch();
    }, 600);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipos, logradouro, numero, bairro, cep]);

  const runSearch = async () => {
    if (!hasAnyFilter) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('itbi-search', {
        body: {
          tipos,
          logradouro,
          numero,
          bairro,
          cep,
        },
      });

      if (error) throw error;

      setResults(data?.results ?? []);
      setHasSearched(true);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao buscar transações ITBI');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const clearAll = () => {
    setTipos([]);
    setLogradouro('');
    setNumero('');
    setBairro('');
    setCep('');
    setResults([]);
    setHasSearched(false);
  };

  const toggleTipo = (value: string) => {
    setTipos((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  };

  const tiposLabel = tipos.length === 0
    ? 'Todos os tipos'
    : tipos.length === 1
    ? TIPOS.find((t) => t.value === tipos[0])?.label ?? '1 tipo'
    : `${tipos.length} tipos selecionados`;

  const stats = useMemo(() => {
    if (results.length === 0) return null;
    const valid = results.filter((r) => r.valor_transacao && Number(r.valor_transacao) > 0);
    if (valid.length === 0) return null;
    const valores = valid.map((r) => Number(r.valor_transacao)).sort((a, b) => a - b);
    const total = valores.reduce((s, v) => s + v, 0);
    const media = total / valores.length;
    const mediana =
      valores.length % 2 === 0
        ? (valores[valores.length / 2 - 1] + valores[valores.length / 2]) / 2
        : valores[Math.floor(valores.length / 2)];
    return {
      count: valid.length,
      media,
      mediana,
      min: valores[0],
      max: valores[valores.length - 1],
    };
  }, [results]);

  const exportXLSX = () => {
    if (results.length === 0) return;
    const rows = results.map((r) => ({
      'Data': r.data_transacao ? new Date(r.data_transacao).toLocaleDateString('pt-BR') : '',
      'Logradouro': r.logradouro,
      'Número': r.numero ?? '',
      'Complemento': r.complemento ?? '',
      'Bairro': r.bairro ?? '',
      'CEP': r.cep ?? '',
      'SQL/IPTU': r.sql_iptu ?? '',
      'Área (m²)': r.area_construida ?? '',
      'Valor Transação (R$)': r.valor_transacao ?? '',
      'Valor Venal (R$)': r.valor_venal ?? '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 12 }, { wch: 35 }, { wch: 8 }, { wch: 18 }, { wch: 22 },
      { wch: 11 }, { wch: 14 }, { wch: 10 }, { wch: 18 }, { wch: 18 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ITBI');
    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `itbi_pesquisa_${stamp}.xlsx`);
    toast.success('Planilha exportada');
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-display font-semibold flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              Pesquisa ITBI — São Paulo
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Consulta na base oficial de transações da Prefeitura. Os filtros são combinados (E).
            </p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <span>Filtros</span>
              {hasAnyFilter && (
                <Button variant="ghost" size="sm" onClick={clearAll} className="h-7 text-xs">
                  <X className="h-3 w-3 mr-1" /> Limpar
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="lg:col-span-2 space-y-1">
              <Label className="text-xs">Tipo</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-9 w-full justify-between font-normal"
                  >
                    <span className={tipos.length === 0 ? 'text-muted-foreground' : ''}>
                      {tiposLabel}
                    </span>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2" align="start">
                  <div className="space-y-1">
                    {TIPOS.map((t) => {
                      const checked = tipos.includes(t.value);
                      return (
                        <label
                          key={t.value}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-accent cursor-pointer text-sm"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggleTipo(t.value)}
                          />
                          <span>{t.label}</span>
                        </label>
                      );
                    })}
                    {tipos.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-full text-xs mt-1"
                        onClick={() => setTipos([])}
                      >
                        Limpar tipos
                      </Button>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div className="lg:col-span-2 space-y-1">
              <Label className="text-xs">Logradouro (rua, avenida, estrada...)</Label>
              <Input
                value={logradouro}
                onChange={(e) => setLogradouro(e.target.value)}
                placeholder="Ex: Itacema"
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Número</Label>
              <Input
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                placeholder="Ex: 300"
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">CEP</Label>
              <Input
                value={cep}
                onChange={(e) => setCep(e.target.value)}
                placeholder="Ex: 04530"
                className="h-9"
                inputMode="numeric"
              />
            </div>
            <div className="lg:col-span-3 space-y-1">
              <Label className="text-xs">Bairro</Label>
              <Input
                value={bairro}
                onChange={(e) => setBairro(e.target.value)}
                placeholder="Ex: Itaim Bibi"
                className="h-9"
              />
            </div>
            <div className="lg:col-span-3 flex items-end">
              <Button onClick={runSearch} disabled={!hasAnyFilter || loading} className="w-full h-9">
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" /> Pesquisar agora
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Resumo */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <Card><CardContent className="p-3"><div className="text-[10px] text-muted-foreground uppercase">Transações</div><div className="text-base font-semibold">{stats.count}</div></CardContent></Card>
            <Card><CardContent className="p-3"><div className="text-[10px] text-muted-foreground uppercase">Mediana</div><div className="text-sm font-semibold tabular-nums">{fmtBRL(stats.mediana)}</div></CardContent></Card>
            <Card><CardContent className="p-3"><div className="text-[10px] text-muted-foreground uppercase">Média</div><div className="text-sm font-semibold tabular-nums">{fmtBRL(stats.media)}</div></CardContent></Card>
            <Card><CardContent className="p-3"><div className="text-[10px] text-muted-foreground uppercase">Mínimo</div><div className="text-sm font-semibold tabular-nums">{fmtBRL(stats.min)}</div></CardContent></Card>
            <Card><CardContent className="p-3"><div className="text-[10px] text-muted-foreground uppercase">Máximo</div><div className="text-sm font-semibold tabular-nums">{fmtBRL(stats.max)}</div></CardContent></Card>
          </div>
        )}

        {/* Resultados */}
        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">
              {hasSearched ? (
                <>Resultados <Badge variant="secondary" className="ml-2">{results.length}</Badge></>
              ) : (
                'Resultados'
              )}
            </CardTitle>
            {results.length > 0 && (
              <Button variant="outline" size="sm" onClick={exportXLSX} className="h-8">
                <Download className="h-3.5 w-3.5 mr-1.5" /> Excel
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {!hasSearched && !loading && (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Preencha um ou mais filtros acima para buscar transações na base ITBI.
              </p>
            )}
            {loading && results.length === 0 && (
              <div className="py-8 text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
              </div>
            )}
            {hasSearched && !loading && results.length === 0 && (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nenhuma transação encontrada com os filtros atuais.
              </p>
            )}
            {results.length > 0 && (
              <>
                {/* Mobile: cards */}
                <div className="sm:hidden space-y-2">
                  {sortedResults.slice(0, 500).map((r) => (
                    <div key={r.id} className="border rounded-lg p-3 bg-card text-xs space-y-1">
                      <div className="flex justify-between items-start gap-2">
                        <div className="font-medium">{r.logradouro}{r.numero ? `, ${r.numero}` : ''}</div>
                        <div className="text-muted-foreground whitespace-nowrap">{fmtDate(r.data_transacao)}</div>
                      </div>
                      {r.complemento && <div className="text-muted-foreground">{r.complemento}</div>}
                      {r.bairro && <div className="text-muted-foreground">{r.bairro}</div>}
                      <div className="flex justify-between pt-1 border-t border-border/50">
                        <div>
                          <div className="text-[10px] text-muted-foreground">Transação</div>
                          <div className="font-semibold tabular-nums">{fmtBRL(r.valor_transacao)}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] text-muted-foreground">Venal</div>
                          <div className="tabular-nums">{fmtBRL(r.valor_venal)}</div>
                        </div>
                      </div>
                      {r.area_construida != null && (
                        <div className="text-muted-foreground">Área: {Number(r.area_construida).toLocaleString('pt-BR')} m²</div>
                      )}
                    </div>
                  ))}
                  {results.length > 500 && (
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                      Mostrando os primeiros 500 resultados. Refine os filtros para ver mais.
                    </p>
                  )}
                </div>

                {/* Desktop: tabela */}
                <div className="hidden sm:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {([
                          { field: 'data_transacao' as const, label: 'Data', align: 'left' },
                          { field: 'logradouro' as const, label: 'Logradouro', align: 'left' },
                          { field: 'numero' as const, label: 'Nº', align: 'left' },
                          { field: 'complemento' as const, label: 'Complemento', align: 'left' },
                          { field: 'bairro' as const, label: 'Bairro', align: 'left' },
                          { field: 'area_construida' as const, label: 'Área', align: 'right' },
                          { field: 'valor_transacao' as const, label: 'Valor Transação', align: 'right' },
                          { field: 'valor_venal' as const, label: 'Valor Venal', align: 'right' },
                          { field: 'sql_iptu' as const, label: 'SQL/IPTU', align: 'left' },
                        ]).map((col) => (
                          <TableHead
                            key={col.field}
                            className={`text-xs uppercase tracking-wide cursor-pointer select-none hover:text-foreground transition-colors ${col.align === 'right' ? 'text-right' : ''}`}
                            onClick={() => toggleSort(col.field)}
                          >
                            <span className={`inline-flex items-center gap-1 ${col.align === 'right' ? 'flex-row-reverse' : ''}`}>
                              {col.label}
                              <SortIcon field={col.field} />
                            </span>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedResults.slice(0, 500).map((r, i) => (
                        <TableRow key={r.id} className={i % 2 === 1 ? 'bg-muted/30' : ''}>
                          <TableCell className="py-2 text-xs whitespace-nowrap">{fmtDate(r.data_transacao)}</TableCell>
                          <TableCell className="py-2 text-xs">{r.logradouro}</TableCell>
                          <TableCell className="py-2 text-xs tabular-nums">{r.numero ?? '—'}</TableCell>
                          <TableCell className="py-2 text-xs">{r.complemento ?? '—'}</TableCell>
                          <TableCell className="py-2 text-xs">{r.bairro ?? '—'}</TableCell>
                          <TableCell className="py-2 text-xs text-right tabular-nums whitespace-nowrap">
                            {r.area_construida != null ? `${Number(r.area_construida).toLocaleString('pt-BR')} m²` : '—'}
                          </TableCell>
                          <TableCell className="py-2 text-xs text-right tabular-nums whitespace-nowrap font-semibold">
                            {fmtBRL(r.valor_transacao)}
                          </TableCell>
                          <TableCell className="py-2 text-xs text-right tabular-nums whitespace-nowrap text-muted-foreground">
                            {fmtBRL(r.valor_venal)}
                          </TableCell>
                          <TableCell className="py-2 text-xs text-muted-foreground">{r.sql_iptu ?? '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {results.length > 500 && (
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                      Mostrando os primeiros 500 resultados. Refine os filtros para ver mais.
                    </p>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
