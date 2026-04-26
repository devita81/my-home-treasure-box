import { useState, useRef, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, Send, Loader2, Bot, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useProperties } from '@/contexts/PropertyContext';
import { Property } from '@/types/property';
import { streamChat } from '@/lib/ai-stream';

type Message = { role: 'user' | 'assistant'; content: string };

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
  Condomínio: ${fmt(p.valor_condominio)} | IPTU anual: ${fmt(p.iptu_value)} | IPTU pago: ${p.iptu_pago ? 'Sim' : 'Não'}
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

export const GlobalAIChatDialog = ({ open, onOpenChange }: GlobalAIChatDialogProps) => {
  const { properties } = useProperties();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const propertiesContext = useMemo(() => buildPropertiesContext(properties), [properties]);

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
                  <div className={`rounded-xl px-3 sm:px-4 py-2 sm:py-3 max-w-[85%] ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary'
                  }`}>
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none text-[12px]">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
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
