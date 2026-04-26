import { useState, useRef, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, Send, Loader2, Bot, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useProperties } from '@/contexts/PropertyContext';
import { Property } from '@/types/property';
import { streamChat } from '@/lib/ai-stream';
import { supabase } from '@/integrations/supabase/client';

type Message = { role: 'user' | 'assistant'; content: string };

type BalanceteLite = {
  property_id: string | null;
  rua: string | null;
  numero: string | null;
  apartamento: string | null;
  ano: number;
  mes: number;
  aluguel: number | null;
  condominio: number | null;
  iptu: number | null;
  taxa_administracao: number | null;
  outras_despesas: number | null;
  reembolso_condominio: number | null;
  reembolso_iptu: number | null;
  reembolso_outras_despesas: number | null;
  liquido: number | null;
  locatario: string | null;
  alugado: boolean | null;
};

interface GlobalAIChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function buildPropertiesContext(properties: Property[]): string {
  if (properties.length === 0) return 'Nenhum imóvel cadastrado.';

  const fmt = (v: number | undefined | null) =>
    v != null ? `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'N/A';

  const lines = properties.map((p, i) => {
    const addr = `${p.rua}${p.numero ? ', ' + p.numero : ''}${p.apartamento ? ' Ap ' + p.apartamento : ''} - ${p.bairro}, ${p.cidade}/${p.estado}`;
    return `IMÓVEL ${i + 1}: ${addr}
  Tipo: ${p.tipo_imovel || 'N/A'} | Matrícula: ${p.numero_matricula || 'N/A'}
  Metragem: ${p.metragem ?? 0}m² | Área total: ${p.area_total ?? 0}m² | Área comum: ${p.area_comum ?? 0}m²
  Valor mercado: ${fmt(p.market_value)} | Valor declarado: ${fmt(p.declared_value)}
  Alugado: ${p.alugado ? 'Sim' : 'Não'} | Aluguel: ${fmt(p.valor_aluguel)} | Inquilino: ${p.inquilino || 'N/A'}
  Condomínio: ${fmt(p.valor_condominio)} | IPTU mensal: ${fmt(p.iptu_value)} | IPTU pago: ${p.iptu_pago ? 'Sim' : 'Não'}
  Taxa Adm: ${fmt(p.taxa_administracao)}
  Proprietário papel: ${p.proprietario_papel || 'N/A'}
  Proprietário matrícula: ${p.proprietario_matricula || 'N/A'} (${p.percentual_proprietario_matricula ?? 100}%)
  ${p.proprietario_matricula_ii ? `Proprietário II: ${p.proprietario_matricula_ii} (${p.percentual_proprietario_matricula_ii ?? 0}%)` : ''}
  Validado: ${p.validado ? 'Sim' : 'Não'} | Vendido: ${p.vendido ? 'Sim' : 'Não'}
  Quartos: ${p.quartos ?? 0} | Banheiros: ${p.banheiros ?? 0} | Suítes: ${p.suites ?? 0} | Garagens: ${p.garagens ?? 0}
  Ano construção: ${p.ano_construcao || 'N/A'}
  Observação: ${p.observacao || 'N/A'}`;
  });

  const totalMercado = properties.reduce((s, p) => s + (p.market_value ?? 0), 0);
  const totalDeclarado = properties.reduce((s, p) => s + (p.declared_value ?? 0), 0);
  const totalAluguel = properties.filter(p => p.alugado).reduce((s, p) => s + (p.valor_aluguel ?? 0), 0);
  const alugados = properties.filter(p => p.alugado).length;

  return `RESUMO: ${properties.length} imóveis | ${alugados} alugados | Valor mercado total: ${fmt(totalMercado)} | Valor declarado total: ${fmt(totalDeclarado)} | Aluguel mensal total: ${fmt(totalAluguel)}

${lines.join('\n\n')}`;
}

const MONTH_ABBR = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function buildBalanceteContext(rows: BalanceteLite[]): string {
  if (!rows.length) return 'Nenhum lançamento de balancete registrado.';

  const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const periodLabel = (ano: number, mes: number) => `${MONTH_ABBR[mes - 1]}/${String(ano).slice(-2)}`;

  // Totais consolidados por mês (toda a carteira)
  const monthly = new Map<string, { ano: number; mes: number; receita: number; despesa: number; liquido: number; imoveis: Set<string> }>();
  for (const r of rows) {
    const key = `${r.ano}-${String(r.mes).padStart(2, '0')}`;
    if (!monthly.has(key)) monthly.set(key, { ano: r.ano, mes: r.mes, receita: 0, despesa: 0, liquido: 0, imoveis: new Set() });
    const acc = monthly.get(key)!;
    const aluguel = r.aluguel ?? 0;
    const reembC = r.reembolso_condominio ?? 0;
    const reembI = r.reembolso_iptu ?? 0;
    const reembO = r.reembolso_outras_despesas ?? 0;
    const cond = r.condominio ?? 0;
    const iptu = r.iptu ?? 0;
    const taxa = r.taxa_administracao ?? 0;
    const outras = r.outras_despesas ?? 0;
    acc.receita += Math.max(0, aluguel) + Math.max(0, reembC) + Math.max(0, reembI) + Math.max(0, reembO);
    acc.despesa += Math.min(0, cond) + Math.min(0, iptu) + Math.min(0, taxa) + Math.min(0, outras);
    acc.liquido += r.liquido ?? 0;
    const pid = r.property_id ?? `${r.rua ?? ''}-${r.numero ?? ''}-${r.apartamento ?? ''}`;
    if (aluguel > 0) acc.imoveis.add(pid);
  }
  const monthlySorted = Array.from(monthly.values()).sort((a, b) => a.ano - b.ano || a.mes - b.mes);
  const monthlyLines = monthlySorted.map(m =>
    `  ${periodLabel(m.ano, m.mes)}: receita ${fmt(m.receita)} | despesa ${fmt(m.despesa)} | líquido ${fmt(m.liquido)} | imóveis ativos: ${m.imoveis.size}`
  );

  // Lançamentos por imóvel x mês (resumo)
  type PMKey = string;
  const perPropMonth = new Map<PMKey, { addr: string; ano: number; mes: number; aluguel: number; liquido: number; locatario: string | null }>();
  for (const r of rows) {
    const addr = `${r.rua ?? ''}${r.numero ? ', ' + r.numero : ''}${r.apartamento ? ' Ap ' + r.apartamento : ''}`.trim() || '(sem endereço)';
    const pid = r.property_id ?? addr;
    const k = `${pid}|${r.ano}-${String(r.mes).padStart(2, '0')}`;
    if (!perPropMonth.has(k)) perPropMonth.set(k, { addr, ano: r.ano, mes: r.mes, aluguel: 0, liquido: 0, locatario: r.locatario ?? null });
    const acc = perPropMonth.get(k)!;
    acc.aluguel += r.aluguel ?? 0;
    acc.liquido += r.liquido ?? 0;
    if (!acc.locatario && r.locatario) acc.locatario = r.locatario;
  }

  // Agrupa por imóvel para output legível (somente últimos 24 meses para não estourar contexto)
  const cutoff = monthlySorted.length > 24 ? monthlySorted.slice(-24) : monthlySorted;
  const cutoffSet = new Set(cutoff.map(m => `${m.ano}-${String(m.mes).padStart(2, '0')}`));

  const byProp = new Map<string, { addr: string; entries: { ano: number; mes: number; aluguel: number; liquido: number; locatario: string | null }[] }>();
  for (const v of perPropMonth.values()) {
    if (!cutoffSet.has(`${v.ano}-${String(v.mes).padStart(2, '0')}`)) continue;
    const key = v.addr;
    if (!byProp.has(key)) byProp.set(key, { addr: v.addr, entries: [] });
    byProp.get(key)!.entries.push({ ano: v.ano, mes: v.mes, aluguel: v.aluguel, liquido: v.liquido, locatario: v.locatario });
  }

  const propLines: string[] = [];
  for (const { addr, entries } of byProp.values()) {
    entries.sort((a, b) => a.ano - b.ano || a.mes - b.mes);
    const inner = entries.map(e => `${periodLabel(e.ano, e.mes)} aluguel=${fmt(e.aluguel)} líquido=${fmt(e.liquido)}${e.locatario ? ` (loc: ${e.locatario})` : ''}`).join('; ');
    propLines.push(`- ${addr}: ${inner}`);
  }

  return `BALANCETE — TOTAIS MENSAIS DA CARTEIRA (todos os meses):
${monthlyLines.join('\n')}

BALANCETE POR IMÓVEL — últimos ${cutoff.length} meses (mais recentes):
${propLines.join('\n')}`;
}

// Helpers para renderizar tabelas markdown como cards em mobile e tabelas em desktop
function extractText(node: any): string {
  if (node == null) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (node.props?.children !== undefined) return extractText(node.props.children);
  return '';
}

function getRows(children: any): any[] {
  const arr = Array.isArray(children) ? children : [children];
  const rows: any[] = [];
  for (const child of arr) {
    if (!child) continue;
    const type = child.type;
    const tag = (child.props?.node?.tagName) || (typeof type === 'string' ? type : '');
    if (tag === 'tr') rows.push(child);
    else if (child.props?.children) rows.push(...getRows(child.props.children));
  }
  return rows;
}

function getCells(row: any): any[] {
  const children = row?.props?.children;
  const arr = Array.isArray(children) ? children : [children];
  return arr.filter((c: any) => {
    const tag = c?.props?.node?.tagName || (typeof c?.type === 'string' ? c.type : '');
    return tag === 'th' || tag === 'td';
  });
}

const ResponsiveTable = ({ children }: { children: any }) => {
  const arr = Array.isArray(children) ? children : [children];
  let headerRow: any = null;
  const bodyRows: any[] = [];
  for (const section of arr) {
    if (!section) continue;
    const tag = section?.props?.node?.tagName || (typeof section?.type === 'string' ? section.type : '');
    if (tag === 'thead') {
      const rows = getRows(section.props.children);
      if (rows[0]) headerRow = rows[0];
    } else if (tag === 'tbody') {
      bodyRows.push(...getRows(section.props.children));
    }
  }
  const headers = headerRow ? getCells(headerRow).map(extractText) : [];

  return (
    <>
      {/* Mobile: cards */}
      <div className="sm:hidden my-2 space-y-2">
        {bodyRows.map((row, i) => {
          const cells = getCells(row);
          return (
            <div key={i} className="rounded-md border border-border bg-background p-2 shadow-sm">
              {cells.map((cell, j) => {
                const label = headers[j] || `Campo ${j + 1}`;
                const value = extractText(cell).trim();
                if (!value || value === '-') return null;
                return (
                  <div key={j} className="flex gap-2 py-0.5 border-b border-border/40 last:border-0">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide shrink-0 w-[35%]">
                      {label}
                    </span>
                    <span className="text-[11px] text-foreground/90 flex-1 break-words">
                      {value}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      {/* Desktop: tabela tradicional */}
      <div className="hidden sm:block my-2 -mx-1 overflow-x-auto rounded-md border border-border bg-background">
        <table className="w-full border-collapse text-[11px]">{children}</table>
      </div>
    </>
  );
};

export const GlobalAIChatDialog = ({ open, onOpenChange }: GlobalAIChatDialogProps) => {
  const { properties } = useProperties();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [balanceteRows, setBalanceteRows] = useState<BalanceteLite[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Carrega balancete uma vez quando o diálogo abre
  useEffect(() => {
    if (!open || balanceteRows.length > 0) return;
    (async () => {
      const { data } = await supabase
        .from('property_balancete')
        .select('property_id, rua, numero, apartamento, ano, mes, aluguel, condominio, iptu, taxa_administracao, outras_despesas, reembolso_condominio, reembolso_iptu, reembolso_outras_despesas, liquido, locatario, alugado')
        .order('ano', { ascending: true })
        .order('mes', { ascending: true })
        .limit(5000);
      if (data) setBalanceteRows(data as BalanceteLite[]);
    })();
  }, [open, balanceteRows.length]);

  const propertiesContext = useMemo(() => {
    const base = buildPropertiesContext(properties);
    const bal = buildBalanceteContext(balanceteRows);
    return `${base}\n\n${bal}`;
  }, [properties, balanceteRows]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      let assistantContent = '';
      await streamChat({
        endpoint: 'chat-global',
        body: { messages: newMessages, propertiesContext },
        onDelta: (chunk) => {
          assistantContent += chunk;
          setMessages([...newMessages, { role: 'assistant', content: assistantContent }]);
        },
      });
      if (!assistantContent) {
        setMessages([...newMessages, { role: 'assistant', content: 'Sem resposta da IA.' }]);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro desconhecido';
      setMessages([...newMessages, { role: 'assistant', content: `❌ Erro: ${msg}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!grid-cols-1 w-[100vw] max-w-[100vw] sm:max-w-2xl sm:w-[calc(100vw-2rem)] h-[100dvh] sm:h-[80vh] max-h-[100dvh] sm:max-h-[80vh] flex flex-col p-0 gap-0 rounded-none sm:rounded-lg border-0 sm:border left-0 right-0 translate-x-0 sm:left-[50%] sm:translate-x-[-50%] top-0 translate-y-0 sm:top-[50%] sm:translate-y-[-50%] overflow-hidden [&>button.absolute]:top-[max(1rem,calc(env(safe-area-inset-top)+0.5rem))] [&>button.absolute]:right-3 [&>button.absolute]:z-10 [&>button.absolute]:bg-background/80 [&>button.absolute]:backdrop-blur-sm [&>button.absolute]:rounded-full [&>button.absolute]:p-1.5">
        <DialogHeader
          className="px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4 border-b shrink-0 pr-12 sm:pr-12"
          style={{ paddingTop: 'max(0.75rem, calc(env(safe-area-inset-top) + 0.5rem))' }}
        >
          <DialogTitle className="flex items-center gap-2 text-sm sm:text-base">
            <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="truncate">Assistente IA — Imóveis</span>
          </DialogTitle>
          <p className="text-[10px] sm:text-[11px] text-muted-foreground">
            Pergunte sobre seus imóveis, valores, rentabilidade...
          </p>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-hidden" ref={scrollRef}>
          <ScrollArea className="h-full px-3 sm:px-6 py-3 sm:py-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-8 sm:py-12">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-3">
                  <Sparkles className="h-7 w-7 text-primary" />
                </div>
                <p className="text-sm mb-2">Tenho acesso aos seus {properties.length} imóveis.</p>
                <p className="text-[11px] text-muted-foreground px-4">
                  Ex: "Qual meu imóvel mais rentável?", "Quanto recebo de aluguel líquido?"
                </p>
              </div>
            )}
            <div className="space-y-3 sm:space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-2 sm:gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                  {msg.role === 'assistant' && (
                    <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shrink-0 mt-1">
                      <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
                    </div>
                  )}
                  <div className={`rounded-xl px-3 sm:px-4 py-2 sm:py-3 ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground max-w-[85%]'
                      : 'bg-secondary max-w-[92%] sm:max-w-[88%] w-full'
                  }`}>
                    {msg.role === 'assistant' ? (
                      <div className="text-[12px] leading-relaxed space-y-2 [&_p]:my-1 [&_h1]:text-[14px] [&_h1]:font-bold [&_h1]:mt-3 [&_h1]:mb-1 [&_h2]:text-[13px] [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1 [&_h3]:text-[12px] [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:my-0.5 [&_strong]:font-semibold [&_code]:bg-background/60 [&_code]:px-1 [&_code]:rounded [&_code]:text-[11px]">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            table: ({ node, children }) => (
                              <ResponsiveTable>{children}</ResponsiveTable>
                            ),
                            thead: ({ node, ...props }) => (
                              <thead className="bg-muted/80" {...props} />
                            ),
                            tr: ({ node, ...props }) => (
                              <tr className="border-b border-border last:border-0 even:bg-muted/30" {...props} />
                            ),
                            th: ({ node, ...props }) => (
                              <th className="border-r border-border last:border-0 px-2 py-1.5 text-left font-semibold text-foreground whitespace-nowrap" {...props} />
                            ),
                            td: ({ node, ...props }) => (
                              <td className="border-r border-border last:border-0 px-2 py-1.5 align-top text-foreground/90" {...props} />
                            ),
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-[12px] whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center shrink-0 mt-1">
                      <User className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.role === 'user' && (
                <div className="flex gap-2 sm:gap-3">
                  <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shrink-0">
                    <Sparkles className="h-3.5 w-3.5 text-primary-foreground animate-pulse" />
                  </div>
                  <div className="bg-secondary rounded-xl px-4 py-3">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        <div
          className="border-t px-2 sm:px-6 py-2 sm:py-4 shrink-0 bg-background w-full max-w-full overflow-hidden"
          style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
        >
          <div className="flex gap-1.5 sm:gap-2 items-end w-full max-w-full">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pergunte sobre seus imóveis..."
              className="resize-none min-h-[42px] max-h-[120px] flex-1 min-w-0 w-full text-base sm:text-sm"
              style={{ fontSize: '16px' }}
              rows={1}
            />
            <Button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              size="icon"
              className="shrink-0 h-[42px] w-[42px] sm:h-11 sm:w-11"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
