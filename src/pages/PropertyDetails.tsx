import { useParams, Navigate, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { AIChatDialog } from '@/components/property/AIChatDialog';
import { useProperties } from '@/contexts/PropertyContext';
import { PropertyMapImage } from '@/components/property/PropertyMapImage';
import { DocumentUpload } from '@/components/property/DocumentUpload';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { 
  MapPin, 
  Edit, 
  ArrowLeft, 
  DollarSign,
  FileText, 
  CheckCircle, 
  XCircle,
  Calendar,
  Home,
  Key,
  Building,
  Ruler,
  BedDouble,
  Bath,
  Car,
  Search,
  Loader2,
  ExternalLink,
  MessageSquare,
  TrendingUp
} from 'lucide-react';

interface MarketEstimates {
  vendaMin: string | null;
  vendaMed: string | null;
  vendaMax: string | null;
  aluguelMin: string | null;
  aluguelMed: string | null;
  aluguelMax: string | null;
}

const parseEstimatesFromResult = (result: string): MarketEstimates => {
  const estimates: MarketEstimates = {
    vendaMin: null, vendaMed: null, vendaMax: null,
    aluguelMin: null, aluguelMed: null, aluguelMax: null,
  };

  // Look for the table rows with "Valor de Venda" and "Aluguel Mensal"
  const lines = result.split('\n');
  for (const line of lines) {
    if (!line.includes('|')) continue;
    const cells = line.split('|').map(c => c.trim()).filter(Boolean);
    if (cells.length < 4) continue;

    const label = cells[0].toLowerCase();
    if (label.includes('venda') && !label.includes('m²') && !label.includes('preço')) {
      estimates.vendaMin = cells[1] || null;
      estimates.vendaMax = cells[2] || null;
      estimates.vendaMed = cells[3] || null;
    }
    if (label.includes('aluguel')) {
      estimates.aluguelMin = cells[1] || null;
      estimates.aluguelMax = cells[2] || null;
      estimates.aluguelMed = cells[3] || null;
    }
  }

  return estimates;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatInlineMarkdown = (text: string) =>
  escapeHtml(text)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary underline underline-offset-4 hover:text-primary/80 inline-flex items-center gap-1">$1 ↗</a>')
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
    .replace(/`([^`]+)`/g, '<code class="rounded bg-muted px-1.5 py-0.5 text-[11px] text-foreground">$1</code>');

const isCompactMetricCell = (text: string) => {
  const value = text.trim();
  return /^(R\$\s?[\d\.]+(?:,\d+)?(?:\/m²|\/m2)?)$/.test(value) || /^(\d+[\d\.,]*\s?(?:m²|m2|%|anos?)?)$/.test(value);
};

const renderMarkdownTable = (tableLines: string[]) => {
  const getCells = (line: string) => line.split('|').slice(1, -1).map((cell) => formatInlineMarkdown(cell.trim()));
  const headers = getCells(tableLines[0]);
  const rows = tableLines.slice(2).map(getCells).filter((row) => row.some(Boolean));
  const hasNarrativeLastColumn = rows.some((row) => {
    const lastCell = row[row.length - 1]?.replace(/<[^>]+>/g, '').trim() || '';
    return lastCell.length > 28 && !isCompactMetricCell(lastCell);
  });

  let html = '<div class="my-5 overflow-hidden rounded-xl border border-border bg-card/80 shadow-sm"><div class="overflow-x-auto"><table class="w-full border-collapse text-sm';
  html += hasNarrativeLastColumn ? ' table-fixed' : '';
  html += '">';

  if (hasNarrativeLastColumn && headers.length === 4) {
    html += '<colgroup><col style="width: 17%" /><col style="width: 15%" /><col style="width: 15%" /><col style="width: 53%" /></colgroup>';
  }

  html += '<thead><tr class="border-b border-border/70 bg-muted/50">';
  headers.forEach((header, index) => {
    const alignClass = index === 0 || (hasNarrativeLastColumn && index === headers.length - 1) ? 'text-left' : 'text-right';
    html += `<th class="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground ${alignClass}">${header}</th>`;
  });
  html += '</tr></thead><tbody>';

  rows.forEach((row) => {
    html += '<tr class="border-b border-border/50 last:border-b-0">';
    row.forEach((cell, index) => {
      const plainText = cell.replace(/<[^>]+>/g, '').trim();
      const isNarrativeCell = hasNarrativeLastColumn && index === row.length - 1;
      const alignClass = index === 0 || isNarrativeCell ? 'text-left' : isCompactMetricCell(plainText) ? 'text-right whitespace-nowrap tabular-nums' : 'text-left';
      const toneClass = isNarrativeCell ? 'text-muted-foreground leading-6 break-words' : index === 0 ? 'font-semibold text-foreground' : 'font-medium text-foreground';
      html += `<td class="px-4 py-3 align-top ${alignClass} ${toneClass}">${cell || '—'}</td>`;
    });
    html += '</tr>';
  });

  html += '</tbody></table></div></div>';
  return html;
};

const convertMarkdownToHtml = (markdown: string): string => {
  const lines = markdown.split('\n');
  const blocks: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();

    if (!line) {
      index += 1;
      continue;
    }

    const nextLine = lines[index + 1]?.trim() || '';
    const isTableStart = line.startsWith('|') && line.endsWith('|') && /^\|?\s*[:\-\| ]+\|?$/.test(nextLine);

    if (isTableStart) {
      const tableLines = [line, nextLine];
      index += 2;
      while (index < lines.length) {
        const current = lines[index].trim();
        if (!(current.startsWith('|') && current.endsWith('|'))) break;
        tableLines.push(current);
        index += 1;
      }
      blocks.push(renderMarkdownTable(tableLines));
      continue;
    }

    if (line.startsWith('## ')) {
      blocks.push(`<h2 class="mt-8 mb-3 border-b border-border/60 pb-2 text-base font-semibold tracking-[0.04em] text-primary first:mt-0">${formatInlineMarkdown(line.slice(3))}</h2>`);
      index += 1;
      continue;
    }

    if (line.startsWith('### ')) {
      blocks.push(`<h3 class="mt-5 mb-2 text-sm font-semibold uppercase tracking-[0.14em] text-foreground/90">${formatInlineMarkdown(line.slice(4))}</h3>`);
      index += 1;
      continue;
    }

    if (line === '---') {
      blocks.push('<hr class="my-5 border-border/60" />');
      index += 1;
      continue;
    }

    if (line.startsWith('- ')) {
      const items: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith('- ')) {
        items.push(lines[index].trim().slice(2));
        index += 1;
      }
      blocks.push(`<ul class="my-3 space-y-2">${items.map((item) => `<li class="ml-5 list-disc text-sm leading-6 text-muted-foreground">${formatInlineMarkdown(item)}</li>`).join('')}</ul>`);
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const current = lines[index].trim();
      const upcoming = lines[index + 1]?.trim() || '';
      const isUpcomingTable = current.startsWith('|') && current.endsWith('|') && /^\|?\s*[:\-\| ]+\|?$/.test(upcoming);
      if (!current || current.startsWith('## ') || current.startsWith('### ') || current === '---' || current.startsWith('- ') || isUpcomingTable) {
        break;
      }
      paragraphLines.push(current);
      index += 1;
    }

    if (paragraphLines.length > 0) {
      blocks.push(`<p class="text-sm leading-7 text-foreground/85">${paragraphLines.map(formatInlineMarkdown).join('<br />')}</p>`);
      continue;
    }

    index += 1;
  }

  return blocks.join('');
};

const PropertyDetails = () => {
  const { id } = useParams<{ id: string }>();
  const { getPropertyById } = useProperties();
  
  const [searchResult, setSearchResult] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [estimates, setEstimates] = useState<MarketEstimates>({
    vendaMin: null, vendaMed: null, vendaMax: null,
    aluguelMin: null, aluguelMed: null, aluguelMax: null,
  });
  
  const property = id ? getPropertyById(id) : undefined;

  // Load saved estimates from localStorage
  useEffect(() => {
    if (id) {
      const saved = localStorage.getItem(`market-estimates-${id}`);
      if (saved) {
        try {
          setEstimates(JSON.parse(saved));
        } catch { /* ignore */ }
      }
    }
  }, [id]);

  // Função para estimar valor do imóvel via IA
  const estimatePropertyValue = async () => {
    setIsSearching(true);
    setSearchResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('search-property-info', {
        body: {
          cidade: property.cidade,
          rua: property.rua,
          numero: property.numero,
          bairro: property.bairro,
          estado: property.estado,
          tipo_imovel: property.tipo_imovel,
          quartos: property.quartos,
          suites: property.suites,
          banheiros: property.banheiros,
          garagens: property.garagens,
          metragem: property.metragem,
          area_total: property.area_total,
          ano_construcao: property.ano_construcao
        }
      });

      if (error) {
        logger.error('Error estimating property value:', error);
        toast.error('Erro ao estimar valor do imóvel');
        return;
      }

      if (data?.result) {
        setSearchResult(data.result);
        setDialogOpen(true);

        // Parse and save estimates
        const parsed = parseEstimatesFromResult(data.result);
        setEstimates(parsed);
        if (id) {
          localStorage.setItem(`market-estimates-${id}`, JSON.stringify(parsed));
        }
      }
    } catch (error) {
      logger.error('Error:', error);
      toast.error('Erro ao estimar valor do imóvel');
    } finally {
      setIsSearching(false);
    }
  };

  if (!property) {
    return <Navigate to="/" replace />;
  }

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return null;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const toSentenceCase = (text: string) => {
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  };

  const abbreviateOwnerName = (name: string | null | undefined) => {
    if (!name) return '—';
    if (name.toUpperCase().includes('DV')) return 'DV';
    return name;
  };

  const getAddressDisplay = () => {
    let address = toSentenceCase(property.rua);
    if (property.numero) address += `, ${property.numero}`;
    if (property.apartamento) address += ` - Ap ${property.apartamento}`;
    if (property.complemento) address += ` (${toSentenceCase(property.complemento)})`;
    return address;
  };

  const getStatusBadge = () => {
    if (property.vendido) {
      return <Badge className="bg-destructive text-destructive-foreground text-[10px] font-medium">Vendido</Badge>;
    }
    if (property.alugado) {
      return <Badge className="bg-info text-info-foreground text-[10px] font-medium">Alugado</Badge>;
    }
    return <Badge className="bg-success text-success-foreground text-[10px] font-medium">Disponível</Badge>;
  };

  const hasRealPhotos = property.photos && property.photos.length > 0 && property.photos[0];
  const hasEstimates = estimates.vendaMin || estimates.aluguelMin;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header Actions */}
          <div className="flex items-center justify-between">
            <Link to="/">
              <Button variant="ghost">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
            </Link>
            <Link to={`/edit/${property.id}`}>
              <Button>
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </Button>
            </Link>
          </div>

          {/* Hero Image */}
          <div className="relative aspect-[21/9] max-h-[320px] rounded-2xl overflow-hidden">
            {hasRealPhotos ? (
              <img
                src={property.photos[0]}
                alt={`${property.rua}, ${property.numero}`}
                className="h-full w-full object-cover"
              />
            ) : property.latitude != null && property.longitude != null ? (
              <iframe
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${property.longitude! - 0.003},${property.latitude! - 0.002},${property.longitude! + 0.003},${property.latitude! + 0.002}&layer=mapnik&marker=${property.latitude},${property.longitude}`}
                className="h-full w-full border-0"
                loading="lazy"
                title={`${property.rua}, ${property.numero}`}
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center bg-muted">
                <MapPin className="h-12 w-12 text-muted-foreground/30" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/20 to-transparent" />
            
            <div className="absolute bottom-6 left-6 right-6">
              <div className="flex gap-2 mb-3">
                {getStatusBadge()}
                {property.validado ? (
                  <Badge variant="outline" className="bg-card/80 backdrop-blur-sm border-success text-success text-[10px] font-medium">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Validado
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-card/80 backdrop-blur-sm border-warning text-warning text-[10px] font-medium">
                    <XCircle className="h-3 w-3 mr-1" />
                    Pendente
                  </Badge>
                )}
              </div>
              <h1 className="font-display text-lg md:text-xl font-medium text-card mb-1.5">
                {getAddressDisplay()}
              </h1>
              <div className="flex items-center gap-1 text-xs md:text-sm text-card/80">
                <MapPin className="h-3.5 w-3.5" />
                <span>{property.bairro}, {property.cidade} - {property.estado}</span>
              </div>
            </div>
          </div>

          {/* Content Grid - Row 1 */}
          <div className="grid gap-4 lg:grid-cols-4">
            {/* Valores */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-1.5 text-[10px] font-medium tracking-[0.16em] uppercase text-muted-foreground">
                  <DollarSign className="h-3.5 w-3.5 text-primary" />
                  Valores
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                <div className="flex justify-between items-center px-2.5 py-1.5 bg-primary/10 rounded-md">
                  <span className="text-[11px] text-muted-foreground">Mercado</span>
                  <span className="font-normal text-[11px] text-primary">{formatCurrency(property.market_value) || '—'}</span>
                </div>
                <div className="flex justify-between items-center px-2.5 py-1.5 bg-secondary rounded-md">
                  <span className="text-[11px] text-muted-foreground">Valor Declarado</span>
                  <span className="font-normal text-[11px]">{formatCurrency(property.declared_value) || '—'}</span>
                </div>
              </CardContent>
            </Card>

            {/* Estimativas de Mercado (IA) */}
            <Card className="border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-1.5 text-[10px] font-medium tracking-[0.16em] uppercase text-muted-foreground">
                  <TrendingUp className="h-3.5 w-3.5 text-primary" />
                  Estimativas IA
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {hasEstimates ? (
                  <>
                    <div className="space-y-1">
                      <span className="text-[9px] font-medium tracking-wider uppercase text-muted-foreground">Venda</span>
                      <div className="grid grid-cols-3 gap-1">
                        <div className="text-center p-1.5 bg-secondary rounded">
                          <div className="text-[8px] text-muted-foreground">Mín</div>
                          <div className="text-[10px] font-medium truncate">{estimates.vendaMin || '—'}</div>
                        </div>
                        <div className="text-center p-1.5 bg-primary/10 rounded">
                          <div className="text-[8px] text-muted-foreground">Médio</div>
                          <div className="text-[10px] font-medium text-primary truncate">{estimates.vendaMed || '—'}</div>
                        </div>
                        <div className="text-center p-1.5 bg-secondary rounded">
                          <div className="text-[8px] text-muted-foreground">Máx</div>
                          <div className="text-[10px] font-medium truncate">{estimates.vendaMax || '—'}</div>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] font-medium tracking-wider uppercase text-muted-foreground">Aluguel</span>
                      <div className="grid grid-cols-3 gap-1">
                        <div className="text-center p-1.5 bg-secondary rounded">
                          <div className="text-[8px] text-muted-foreground">Mín</div>
                          <div className="text-[10px] font-medium truncate">{estimates.aluguelMin || '—'}</div>
                        </div>
                        <div className="text-center p-1.5 bg-info/10 rounded">
                          <div className="text-[8px] text-muted-foreground">Médio</div>
                          <div className="text-[10px] font-medium text-info truncate">{estimates.aluguelMed || '—'}</div>
                        </div>
                        <div className="text-center p-1.5 bg-secondary rounded">
                          <div className="text-[8px] text-muted-foreground">Máx</div>
                          <div className="text-[10px] font-medium truncate">{estimates.aluguelMax || '—'}</div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-4 text-center">
                    <TrendingUp className="h-6 w-6 text-muted-foreground/30 mb-2" />
                    <span className="text-[10px] text-muted-foreground">
                      Clique em "Análise de Mercado" para gerar estimativas
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Custos */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-1.5 text-[10px] font-medium tracking-[0.16em] uppercase text-muted-foreground">
                  <FileText className="h-3.5 w-3.5 text-primary" />
                  Custos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                <div className="flex justify-between items-center px-2.5 py-1.5 bg-secondary rounded-md">
                  <span className="text-[11px] text-muted-foreground">IPTU (anual)</span>
                  <div className="flex items-center gap-2">
                    <span className="font-normal text-[11px]">{formatCurrency(property.iptu_value) || '—'}</span>
                    {property.iptu_pago ? (
                      <Badge variant="outline" className="border-success text-success text-[10px] font-medium">Pago</Badge>
                    ) : (
                      <Badge variant="outline" className="border-warning text-warning text-[10px] font-medium">Pendente</Badge>
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-center px-2.5 py-1.5 bg-secondary rounded-md">
                  <span className="text-[11px] text-muted-foreground">Condomínio</span>
                  <span className="font-normal text-[11px]">{property.valor_condominio ? `${formatCurrency(property.valor_condominio)}/mês` : '—'}</span>
                </div>
              </CardContent>
            </Card>

            {/* Rentabilidade */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-1.5 text-[10px] font-medium tracking-[0.16em] uppercase text-muted-foreground">
                  <Key className="h-3.5 w-3.5 text-primary" />
                  Renda
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                <div className="flex justify-between items-center px-2.5 py-1.5 bg-secondary rounded-md">
                  <span className="text-[11px] text-muted-foreground">Status</span>
                  <span className={`font-normal text-[11px] ${property.alugado ? 'text-info' : ''}`}>
                    {property.alugado ? 'Alugado' : 'Não alugado'}
                  </span>
                </div>
                <div className="flex justify-between items-center px-2.5 py-1.5 bg-secondary rounded-md">
                  <span className="text-[11px] text-muted-foreground">Aluguel</span>
                  <span className={`font-normal text-[11px] ${property.alugado && property.valor_aluguel ? 'text-info' : ''}`}>
                    {property.valor_aluguel ? `${formatCurrency(property.valor_aluguel)}/mês` : '—'}
                  </span>
                </div>
                {property.alugado && property.inquilino && (
                  <div className="flex justify-between items-center px-2.5 py-1.5 bg-info/10 rounded-md">
                    <span className="text-[11px] text-muted-foreground">Inquilino</span>
                    <span className="font-normal text-[11px]">{property.inquilino}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Content Grid - Row 2 */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Propriedade */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-1.5 text-[10px] font-medium tracking-[0.16em] uppercase text-muted-foreground">
                  <Building className="h-3.5 w-3.5 text-primary" />
                  Propriedade
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                <div className="flex justify-between items-center px-2.5 py-1.5 bg-secondary rounded-md">
                  <span className="text-[11px] text-muted-foreground">Tipo</span>
                  <span className="font-normal text-[11px] capitalize">{property.tipo_imovel || 'Apartamento'}</span>
                </div>
                <div className="flex justify-between items-center px-2.5 py-1.5 bg-secondary rounded-md">
                  <span className="text-[11px] text-muted-foreground">Proprietário (Papel)</span>
                  <span className="font-normal text-[11px]">{abbreviateOwnerName(property.proprietario_papel)}</span>
                </div>
                <div className="flex justify-between items-center px-2.5 py-1.5 bg-secondary rounded-md">
                  <span className="text-[11px] text-muted-foreground">Proprietário (Matrícula)</span>
                  <span className="font-normal text-[11px]">
                    {abbreviateOwnerName(property.proprietario_matricula)}
                    {property.percentual_proprietario_matricula != null && property.percentual_proprietario_matricula !== 100 && (
                      <span className="text-muted-foreground ml-1">({property.percentual_proprietario_matricula}%)</span>
                    )}
                  </span>
                </div>
                {property.proprietario_matricula_ii && (
                  <div className="flex justify-between items-center px-2.5 py-1.5 bg-secondary rounded-md">
                    <span className="text-[11px] text-muted-foreground">Proprietário 2 (Matrícula)</span>
                    <span className="font-normal text-[11px]">
                      {abbreviateOwnerName(property.proprietario_matricula_ii)}
                      {property.percentual_proprietario_matricula_ii != null && property.percentual_proprietario_matricula_ii > 0 && (
                        <span className="text-muted-foreground ml-1">({property.percentual_proprietario_matricula_ii}%)</span>
                      )}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center px-2.5 py-1.5 bg-secondary rounded-md">
                  <span className="text-[11px] text-muted-foreground">Nº Matrícula</span>
                  <span className="font-mono font-normal text-[11px]">{property.numero_matricula || '—'}</span>
                </div>
                <div className="flex justify-between items-center px-2.5 py-1.5 bg-secondary rounded-md">
                  <span className="text-[11px] text-muted-foreground">Nº Contribuinte</span>
                  <span className="font-mono font-normal text-[11px]">{property.numero_contribuinte || '—'}</span>
                </div>
              </CardContent>
            </Card>

            {/* Características */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-1.5 text-[10px] font-medium tracking-[0.16em] uppercase text-muted-foreground">
                  <Home className="h-3.5 w-3.5 text-primary" />
                  Características
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                    <div className="flex items-center gap-2">
                      <BedDouble className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[11px] text-muted-foreground">Quartos</span>
                    </div>
                    <span className="font-normal text-[11px]">{property.quartos || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                    <div className="flex items-center gap-2">
                      <BedDouble className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[11px] text-muted-foreground">Suítes</span>
                    </div>
                    <span className="font-normal text-[11px]">{property.suites || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                    <div className="flex items-center gap-2">
                      <Bath className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[11px] text-muted-foreground">Banheiros</span>
                    </div>
                    <span className="font-normal text-[11px]">{property.banheiros || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                    <div className="flex items-center gap-2">
                      <Car className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[11px] text-muted-foreground">Garagens</span>
                    </div>
                    <span className="font-normal text-[11px]">{property.garagens || '—'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Metragens */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-1.5 text-[10px] font-medium tracking-[0.16em] uppercase text-muted-foreground">
                  <Ruler className="h-3.5 w-3.5 text-primary" />
                  Metragens
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                <div className="flex justify-between items-center px-2.5 py-1.5 bg-secondary rounded-md">
                  <span className="text-[11px] text-muted-foreground">Área Útil</span>
                  <span className="font-normal text-[11px]">{property.metragem ? `${property.metragem} m²` : '—'}</span>
                </div>
                <div className="flex justify-between items-center px-2.5 py-1.5 bg-secondary rounded-md">
                  <span className="text-[11px] text-muted-foreground">Área Comum</span>
                  <span className="font-normal text-[11px]">{property.area_comum ? `${property.area_comum} m²` : '—'}</span>
                </div>
                <div className="flex justify-between items-center px-2.5 py-1.5 bg-primary/10 rounded-md">
                  <span className="text-[11px] text-muted-foreground">Área Total</span>
                  <span className="font-normal text-[11px] text-primary">{property.area_total ? `${property.area_total} m²` : '—'}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Ferramentas de IA */}
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <DollarSign className="h-5 w-5 text-primary" />
                Inteligência Artificial — ChatGPT
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-[11px] text-muted-foreground">
                Use o ChatGPT para análise de mercado automatizada ou chat livre sobre este imóvel.
              </p>
              
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={estimatePropertyValue}
                  disabled={isSearching}
                  className="gap-2"
                  size="lg"
                >
                  {isSearching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  {isSearching ? 'Analisando mercado...' : 'Análise de Mercado'}
                </Button>

                <Button
                  onClick={() => setChatOpen(true)}
                  variant="outline"
                  className="gap-2"
                  size="lg"
                >
                  <MessageSquare className="h-4 w-4" />
                  Chat Livre com IA
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Pesquisa em Sites Externos */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <ExternalLink className="h-5 w-5 text-primary" />
                Pesquisar em Sites de Imóveis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-[11px] text-muted-foreground">
                Compare valores de imóveis similares neste endereço em sites de referência do mercado imobiliário.
              </p>
              
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => {
                    const tipoImovel = property.tipo_imovel || 'imovel';
                    const endereco = `${property.rua} ${property.numero || ''} ${property.bairro} ${property.cidade}`.trim();
                    const searchQuery = encodeURIComponent(`site:zapimoveis.com.br ${endereco} ${tipoImovel} venda`);
                    const bingUrl = `https://www.bing.com/search?q=${searchQuery}`;
                    window.open(bingUrl, '_blank');
                  }}
                >
                  <img 
                    src="https://www.zapimoveis.com.br/favicon.ico" 
                    alt="ZAP" 
                    className="h-4 w-4"
                    onError={(e) => e.currentTarget.style.display = 'none'}
                  />
                  Buscar no ZAP Imóveis
                  <ExternalLink className="h-3 w-3" />
                </Button>

                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => {
                    const tipoImovel = property.tipo_imovel || 'imovel';
                    const endereco = `${property.rua} ${property.numero || ''} ${property.bairro} ${property.cidade}`.trim();
                    const searchQuery = encodeURIComponent(`site:quintoandar.com.br ${endereco} ${tipoImovel}`);
                    const bingUrl = `https://www.bing.com/search?q=${searchQuery}`;
                    window.open(bingUrl, '_blank');
                  }}
                >
                  <img 
                    src="https://www.quintoandar.com.br/favicon.ico" 
                    alt="QuintoAndar" 
                    className="h-4 w-4"
                    onError={(e) => e.currentTarget.style.display = 'none'}
                  />
                  Buscar no QuintoAndar
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Documentos do Imóvel */}
          <DocumentUpload propertyId={property.id} mode="view" />

          {/* Timestamps */}
          <div className="flex items-center justify-center gap-6 py-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>Criado em {formatDate(property.created_at)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>Atualizado em {formatDate(property.updated_at)}</span>
            </div>
          </div>
        </div>
      </main>

      {/* Dialog para resultado da estimativa */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[min(96vw,1100px)] max-w-5xl max-h-[88vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b bg-card">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold pr-8">
              <DollarSign className="h-4 w-4 text-primary" />
              Análise de Mercado — ChatGPT
            </DialogTitle>
            <p className="text-[11px] leading-5 text-muted-foreground">
              Relatório estruturado com estimativas, cenários e leitura de mercado.
            </p>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto bg-muted/20 px-6 py-5">
            {searchResult && (
              <div className="mx-auto max-w-none rounded-2xl border border-border/60 bg-background p-5 shadow-sm">
                <div
                  className="space-y-4 text-sm"
                  dangerouslySetInnerHTML={{
                    __html: convertMarkdownToHtml(searchResult)
                  }}
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Chat Livre com IA */}
      <AIChatDialog
        open={chatOpen}
        onOpenChange={setChatOpen}
        propertyContext={`Endereço: ${property.rua}${property.numero ? `, ${property.numero}` : ''}, ${property.bairro}, ${property.cidade} - ${property.estado}\nTipo: ${property.tipo_imovel || 'Apartamento'}\nÁrea: ${property.metragem ? `${property.metragem} m²` : 'N/I'}\nQuartos: ${property.quartos || 0} (${property.suites || 0} suítes)\nBanheiros: ${property.banheiros || 0}\nGaragens: ${property.garagens || 0}\nAno: ${property.ano_construcao || 'N/I'}`}
      />
    </div>
  );
};

export default PropertyDetails;
