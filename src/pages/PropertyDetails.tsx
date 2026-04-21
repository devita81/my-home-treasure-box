import { useParams, Navigate, Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { AIChatDialog } from '@/components/property/AIChatDialog';
import { useProperties } from '@/contexts/PropertyContext';
import { PropertyMapImage } from '@/components/property/PropertyMapImage';
import { PropertyCardMap } from '@/components/property/PropertyCardMap';
import { PropertyReportDialog } from '@/components/property/PropertyReportDialog';
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
  Building2,
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

// Converte "R$ 1.510.200" / "R$ 6.000,50" / "R$ 9.580/m²" em número (1510200, 6000.5, 9580)
const parseCurrencyToNumber = (raw: string | null | undefined): number | null => {
  if (!raw) return null;
  const cleaned = raw.replace(/R\$|\/m²|\/m2|\s/gi, '').trim();
  if (!cleaned) return null;
  // BRL: ponto = milhar, vírgula = decimal -> remove pontos, troca vírgula por ponto
  const normalized = cleaned.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(normalized);
  return Number.isFinite(num) ? num : null;
};

const formatBRLCompact = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

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

// Resolve a "fonte" (origem dos dados) para uma linha da tabela
// com base no título da primeira coluna e no contexto global (se há ITBI).
const resolveSourceLabel = (rowTitlePlain: string, hasItbi: boolean): { label: string; tone: 'itbi' | 'ai' } | null => {
  const t = rowTitlePlain.toLowerCase();
  if (!t) return null;
  if (t.includes('valor de venda')) {
    return hasItbi
      ? { label: 'Fonte: ITBI Prefeitura SP (transações reais)', tone: 'itbi' }
      : { label: 'Fonte: Estimativa IA (comparáveis de mercado)', tone: 'ai' };
  }
  if (t.includes('aluguel')) {
    return { label: 'Fonte: Estimativa IA (comparáveis de mercado)', tone: 'ai' };
  }
  if (t.includes('preço por m') || t.includes('preco por m')) {
    return { label: 'Fonte: Estimativa IA (comparáveis de mercado)', tone: 'ai' };
  }
  return null;
};

const renderSourceBadgeHtml = (src: { label: string; tone: 'itbi' | 'ai' }) => {
  const cls = src.tone === 'itbi'
    ? 'bg-amber-100 text-amber-900 border-amber-300'
    : 'bg-primary/10 text-primary border-primary/30';
  return `<span class="mt-1 inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.06em] ${cls}">${src.label}</span>`;
};

const renderMarkdownTable = (tableLines: string[], hasItbi = false) => {
  const getCells = (line: string) => line.split('|').slice(1, -1).map((cell) => formatInlineMarkdown(cell.trim()));
  const headers = getCells(tableLines[0]);
  const rows = tableLines.slice(2).map(getCells).filter((row) => row.some(Boolean));
  const hasNarrativeLastColumn = rows.some((row) => {
    const lastCell = row[row.length - 1]?.replace(/<[^>]+>/g, '').trim() || '';
    return lastCell.length > 28 && !isCompactMetricCell(lastCell);
  });

  // Tabelas com muitas colunas (>=6) só viram tabela em telas grandes (lg+),
  // caso contrário ficam como cards para evitar scroll horizontal no mobile/tablet.
  const isWide = headers.length >= 6;
  const desktopShowClass = isWide ? 'hidden lg:block' : 'hidden sm:block';
  const mobileShowClass = isWide ? 'lg:hidden' : 'sm:hidden';

  // ===== Desktop view: traditional table =====
  let desktop = `<div class="my-5 ${desktopShowClass} overflow-hidden rounded-xl border border-border bg-card shadow-sm"><div class="overflow-x-auto"><table class="w-full border-collapse text-[13px]`;
  desktop += hasNarrativeLastColumn ? ' table-fixed' : '';
  desktop += '">';

  if (hasNarrativeLastColumn && headers.length === 4) {
    desktop += '<colgroup><col style="width: 17%" /><col style="width: 15%" /><col style="width: 15%" /><col style="width: 53%" /></colgroup>';
  }

  desktop += '<thead><tr class="border-b-2 border-border bg-muted">';
  headers.forEach((header, index) => {
    const alignClass = index === 0 || (hasNarrativeLastColumn && index === headers.length - 1) ? 'text-left' : 'text-right';
    desktop += `<th class="px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-foreground/80 ${alignClass} whitespace-nowrap">${header}</th>`;
  });
  desktop += '</tr></thead><tbody>';

  rows.forEach((row, rowIdx) => {
    const zebra = rowIdx % 2 === 1 ? 'bg-muted/30' : '';
    desktop += `<tr class="border-b border-border/40 last:border-b-0 ${zebra} hover:bg-accent/40 transition-colors">`;
    row.forEach((cell, index) => {
      const plainText = cell.replace(/<[^>]+>/g, '').trim();
      const isNarrativeCell = hasNarrativeLastColumn && index === row.length - 1;
      const isMetric = isCompactMetricCell(plainText);
      const alignClass = index === 0 || isNarrativeCell
        ? 'text-left'
        : isMetric ? 'text-right whitespace-nowrap tabular-nums' : 'text-left';
      const toneClass = isNarrativeCell
        ? 'text-muted-foreground leading-6 break-words text-[12px]'
        : index === 0
          ? 'font-semibold text-foreground whitespace-nowrap'
          : isMetric
            ? 'font-semibold text-foreground'
            : 'text-foreground';
      desktop += `<td class="px-3 py-2.5 align-middle ${alignClass} ${toneClass}">${cell || '—'}</td>`;
    });
    desktop += '</tr>';
  });

  desktop += '</tbody></table></div></div>';

  // ===== Mobile/tablet view: card list =====
  let mobile = `<div class="my-4 ${mobileShowClass} space-y-2.5">`;
  rows.forEach((row) => {
    const titleCell = row[0] || '—';
    mobile += '<div class="rounded-lg border border-border bg-card/80 shadow-sm p-3">';
    mobile += `<div class="text-[12px] font-semibold text-foreground mb-2 break-words">${titleCell}</div>`;
    mobile += '<dl class="space-y-1.5">';
    for (let i = 1; i < row.length; i++) {
      const cell = row[i] || '—';
      const plainText = cell.replace(/<[^>]+>/g, '').trim();
      const header = headers[i] || '';
      const isNarrativeCell = hasNarrativeLastColumn && i === row.length - 1;
      if (isNarrativeCell) {
        mobile += '<div class="pt-1.5 mt-1.5 border-t border-border/60">';
        if (header) {
          mobile += `<dt class="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-1">${header}</dt>`;
        }
        mobile += `<dd class="text-[11px] leading-5 text-muted-foreground break-words">${cell}</dd>`;
        mobile += '</div>';
      } else {
        const valueAlign = isCompactMetricCell(plainText) ? 'tabular-nums' : '';
        mobile += '<div class="flex items-start justify-between gap-3">';
        mobile += `<dt class="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground shrink-0">${header}</dt>`;
        mobile += `<dd class="text-[11px] font-medium text-foreground text-right break-words min-w-0 ${valueAlign}">${cell}</dd>`;
        mobile += '</div>';
      }
    }
    mobile += '</dl></div>';
  });
  mobile += '</div>';

  return desktop + mobile;
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
      blocks.push(`<h2 class="mt-8 mb-3 border-b border-primary/30 pb-2 text-base font-bold text-foreground first:mt-0">${formatInlineMarkdown(line.slice(3))}</h2>`);
      index += 1;
      continue;
    }

    if (line.startsWith('### ')) {
      blocks.push(`<h3 class="mt-5 mb-2 text-sm font-semibold text-foreground">${formatInlineMarkdown(line.slice(4))}</h3>`);
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
      blocks.push(`<ul class="my-3 space-y-2.5">${items.map((item) => `<li class="ml-5 list-disc text-sm leading-6 text-foreground">${formatInlineMarkdown(item)}</li>`).join('')}</ul>`);
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
      blocks.push(`<p class="text-sm leading-7 text-foreground">${paragraphLines.map(formatInlineMarkdown).join('<br />')}</p>`);
      continue;
    }

    index += 1;
  }

  return blocks.join('');
};

const PropertyDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getPropertyById } = useProperties();
  
  const [searchResult, setSearchResult] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [itbiResult, setItbiResult] = useState<string | null>(null);
  const [isLoadingItbi, setIsLoadingItbi] = useState(false);
  const [itbiDialogOpen, setItbiDialogOpen] = useState(false);
  const [estimates, setEstimates] = useState<MarketEstimates>({
    vendaMin: null, vendaMed: null, vendaMax: null,
    aluguelMin: null, aluguelMed: null, aluguelMax: null,
  });
  
  const property = id ? getPropertyById(id) : undefined;

  // Load saved AI estimate from database (with fallback to legacy localStorage)
  useEffect(() => {
    if (!id) return;

    const loadEstimate = async () => {
      const { data, error } = await (supabase as any)
        .from('properties')
        .select('ai_market_estimate, ai_venda_min, ai_venda_med, ai_venda_max, ai_aluguel_min, ai_aluguel_med, ai_aluguel_max')
        .eq('id', id)
        .maybeSingle();

      if (error || !data) return;

      // Preferir colunas estruturadas (numéricas) — sempre exibe se existirem
      const hasStructured =
        data.ai_venda_min != null || data.ai_venda_med != null || data.ai_venda_max != null ||
        data.ai_aluguel_min != null || data.ai_aluguel_med != null || data.ai_aluguel_max != null;

      if (hasStructured) {
        setEstimates({
          vendaMin: formatBRLCompact(data.ai_venda_min),
          vendaMed: formatBRLCompact(data.ai_venda_med),
          vendaMax: formatBRLCompact(data.ai_venda_max),
          aluguelMin: formatBRLCompact(data.ai_aluguel_min),
          aluguelMed: formatBRLCompact(data.ai_aluguel_med),
          aluguelMax: formatBRLCompact(data.ai_aluguel_max),
        });
      }

      if (data.ai_market_estimate) {
        setSearchResult(data.ai_market_estimate);
        // Se não temos estruturado, derivar do markdown (compat com registros antigos)
        if (!hasStructured) {
          setEstimates(parseEstimatesFromResult(data.ai_market_estimate));
        }
        return;
      }

      // Fallback: migrar do localStorage legado se existir
      const saved = localStorage.getItem(`market-estimates-${id}`);
      if (saved && !hasStructured) {
        try {
          setEstimates(JSON.parse(saved));
        } catch { /* ignore */ }
      }
    };

    loadEstimate();
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

        // Parse estimates and persist full report + structured numeric columns
        const parsed = parseEstimatesFromResult(data.result);

        // Convert para números p/ persistir nas colunas dedicadas
        const numeric = {
          ai_venda_min: parseCurrencyToNumber(parsed.vendaMin),
          ai_venda_med: parseCurrencyToNumber(parsed.vendaMed),
          ai_venda_max: parseCurrencyToNumber(parsed.vendaMax),
          ai_aluguel_min: parseCurrencyToNumber(parsed.aluguelMin),
          ai_aluguel_med: parseCurrencyToNumber(parsed.aluguelMed),
          ai_aluguel_max: parseCurrencyToNumber(parsed.aluguelMax),
        };

        // UI usa os valores formatados a partir dos números (consistente com o que foi salvo)
        setEstimates({
          vendaMin: formatBRLCompact(numeric.ai_venda_min),
          vendaMed: formatBRLCompact(numeric.ai_venda_med),
          vendaMax: formatBRLCompact(numeric.ai_venda_max),
          aluguelMin: formatBRLCompact(numeric.ai_aluguel_min),
          aluguelMed: formatBRLCompact(numeric.ai_aluguel_med),
          aluguelMax: formatBRLCompact(numeric.ai_aluguel_max),
        });

        if (id) {
          const { error: updateError } = await (supabase as any)
            .from('properties')
            .update({
              ai_market_estimate: data.result,
              ai_market_estimate_updated_at: new Date().toISOString(),
              ...numeric,
            })
            .eq('id', id);

          if (updateError) {
            logger.error('Error saving AI estimate:', updateError);
            toast.error('Estimativa gerada, mas falhou ao salvar no banco');
          } else {
            toast.success('Estimativa salva');
            localStorage.removeItem(`market-estimates-${id}`);
          }
        }
      }
    } catch (error) {
      logger.error('Error:', error);
      toast.error('Erro ao estimar valor do imóvel');
    } finally {
      setIsSearching(false);
    }
  };

  // Consulta ITBI da Prefeitura de SP
  const lookupItbi = async () => {
    if (!property) return;
    const cidadeLower = (property.cidade ?? '').toLowerCase();
    if (cidadeLower !== 'são paulo' && cidadeLower !== 'sao paulo') {
      toast.error('Disponível apenas para imóveis em São Paulo (capital)');
      return;
    }

    setIsLoadingItbi(true);
    setItbiResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('itbi-lookup', {
        body: {
          rua: property.rua,
          numero: property.numero,
          apartamento: property.apartamento,
          complemento: property.complemento,
          bairro: property.bairro,
          cidade: property.cidade,
          estado: property.estado,
          cep: (property as any).cep,
          declared_value: property.declared_value,
          market_value: property.market_value,
          tipo_imovel: property.tipo_imovel,
          metragem: property.metragem,
        },
      });

      if (error) {
        logger.error('Erro ITBI:', error);
        toast.error('Erro ao consultar ITBI');
        return;
      }

      if (data?.result) {
        setItbiResult(data.result);
        setItbiDialogOpen(true);
        if (!data.hadData) {
          toast.warning('Nenhuma transação ITBI específica encontrada');
        } else {
          toast.success('Análise ITBI concluída');
        }
      }
    } catch (e) {
      logger.error('Erro ITBI:', e);
      toast.error('Erro ao consultar ITBI');
    } finally {
      setIsLoadingItbi(false);
    }
  };

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

  if (!property) {
    return <Navigate to="/" replace />;
  }

  const hasRealPhotos = property.photos && property.photos.length > 0 && property.photos[0];
  const hasEstimates = estimates.vendaMin || estimates.aluguelMin;

  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <Header />
      
      <main className="container mx-auto overflow-x-hidden px-4 py-8">
        <div className="mx-auto max-w-6xl min-w-0 space-y-6 overflow-x-hidden">
          {/* Header Actions */}
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant="outline"
              onClick={() => {
                if (window.history.length > 1) {
                  navigate(-1);
                } else {
                  navigate('/');
                }
              }}
              className="w-full justify-center border-primary/30 bg-primary/5 font-semibold text-primary shadow-sm hover:bg-primary/10 sm:w-auto"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                variant="outline"
                onClick={() => setReportOpen(true)}
                className="w-full justify-center gap-1.5 border-red-700/40 bg-background shadow-sm hover:border-red-700/60 hover:bg-red-50 sm:w-auto"
              >
                <FileText className="h-4 w-4 text-red-700" />
                <span className="font-medium text-red-800">Relatório PDF</span>
              </Button>
              <Link to={`/edit/${property.id}`} className="w-full sm:w-auto">
                <Button className="w-full justify-center sm:w-auto">
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </Button>
              </Link>
            </div>
          </div>

          {/* Hero Image */}
          <div className="relative isolate z-0 aspect-[21/9] max-h-[320px] rounded-2xl overflow-hidden">
            {hasRealPhotos ? (
              <img
                src={property.photos[0]}
                alt={`${property.rua}, ${property.numero}`}
                className="h-full w-full object-cover"
              />
            ) : property.latitude != null && property.longitude != null ? (
              <PropertyCardMap
                latitude={property.latitude}
                longitude={property.longitude}
                address={`${property.rua}, ${property.numero ?? ''} ${property.bairro}, ${property.cidade}`}
                title={`${property.rua}, ${property.numero ?? ''}`}
                className="h-full w-full"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center bg-muted">
                <MapPin className="h-12 w-12 text-muted-foreground/30" />
              </div>
            )}

            {/* Status badges - top */}
            <div className="absolute top-3 left-3 right-3 flex flex-wrap gap-1.5 md:gap-2 z-[500] pointer-events-none">
              {getStatusBadge()}
              {property.validado ? (
                <Badge variant="outline" className="bg-card/90 backdrop-blur-sm border-success text-success text-[10px] font-medium">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Validado
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-card/90 backdrop-blur-sm border-warning text-warning text-[10px] font-medium">
                  <XCircle className="h-3 w-3 mr-1" />
                  Pendente
                </Badge>
              )}
            </div>

            {/* Address banner - bottom */}
            <div className="absolute bottom-0 left-0 right-0 z-[500] pointer-events-none">
              <div className="bg-gradient-to-t from-foreground/90 via-foreground/70 to-transparent px-4 py-3 md:px-6 md:py-4">
                <h1 className="font-display text-base md:text-xl font-semibold text-card mb-0.5 md:mb-1 leading-tight">
                  {getAddressDisplay()}
                </h1>
                <div className="flex items-center gap-1 text-[11px] md:text-sm text-card/90">
                  <MapPin className="h-3 w-3 md:h-3.5 md:w-3.5 shrink-0" />
                  <span className="truncate">{property.bairro}, {property.cidade} - {property.estado}</span>
                </div>
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
              
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Button
                  onClick={estimatePropertyValue}
                  disabled={isSearching}
                  className="w-full justify-center gap-2 sm:w-auto"
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
                  onClick={lookupItbi}
                  disabled={isLoadingItbi}
                  variant="outline"
                  className="w-full justify-center gap-2 border-blue-700/40 bg-blue-50 text-blue-900 hover:bg-blue-100 sm:w-auto"
                  size="lg"
                  title="Consulta transações ITBI da Prefeitura de São Paulo"
                >
                  {isLoadingItbi ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Building2 className="h-4 w-4" />
                  )}
                  {isLoadingItbi ? 'Consultando ITBI...' : 'Comparar ITBI (SP)'}
                </Button>

                <Button
                  onClick={() => setChatOpen(true)}
                  variant="outline"
                  className="w-full justify-center gap-2 sm:w-auto"
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
              
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Button
                  variant="outline"
                  className="w-full justify-center gap-2 sm:w-auto"
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
                  className="w-full justify-center gap-2 sm:w-auto"
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
          <div className="flex flex-col items-center justify-center gap-2 py-4 text-center text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-6">
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

      <PropertyReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        property={property}
      />

      {/* Dialog ITBI */}
      <Dialog open={itbiDialogOpen} onOpenChange={setItbiDialogOpen}>
        <DialogContent className="w-[min(96vw,1100px)] max-w-5xl max-h-[88vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-4 sm:px-6 pt-6 pb-4 border-b bg-card">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold pr-8">
              <Building2 className="h-4 w-4 text-amber-700" />
              Comparativo ITBI — Prefeitura de São Paulo
            </DialogTitle>
            <p className="text-[11px] leading-5 text-muted-foreground">
              Análise baseada em dados públicos de transações imobiliárias da Prefeitura de SP.
            </p>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto overflow-x-hidden bg-muted/20 px-3 sm:px-6 py-5 min-w-0">
            {itbiResult && (
              <div className="mx-auto max-w-none rounded-2xl border border-border/60 bg-background p-3 sm:p-5 shadow-sm min-w-0">
                <div
                  className="space-y-4 text-sm min-w-0"
                  dangerouslySetInnerHTML={{
                    __html: convertMarkdownToHtml(itbiResult)
                  }}
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PropertyDetails;
