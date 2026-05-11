import { useState, useRef, useEffect, isValidElement, type ReactElement, type ReactNode } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, Send, Loader2, User, Zap } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import { useProperties } from '@/contexts/PropertyContext';
import { chatIa, pingChatIa, type ChatMessage } from '@/lib/ai-chat';

interface GlobalAIChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Helpers para renderizar tabelas markdown como cards em mobile e tabelas em desktop.
// react-markdown passes a HAST 'node' field on props that identifies the original
// markdown element (e.g. node.tagName === 'tr'); we use that to walk the tree.
interface MarkdownNodeProps {
  children?: ReactNode;
  node?: { tagName?: string };
}

const isMarkdownElement = (value: ReactNode): value is ReactElement<MarkdownNodeProps> =>
  isValidElement(value);

const getTag = (element: ReactElement<MarkdownNodeProps>): string =>
  element.props.node?.tagName || (typeof element.type === 'string' ? element.type : '');

function extractText(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (isMarkdownElement(node) && node.props.children !== undefined) {
    return extractText(node.props.children);
  }
  return '';
}

function getRows(children: ReactNode): ReactElement<MarkdownNodeProps>[] {
  const arr = Array.isArray(children) ? children : [children];
  const rows: ReactElement<MarkdownNodeProps>[] = [];
  for (const child of arr) {
    if (!isMarkdownElement(child)) continue;
    if (getTag(child) === 'tr') rows.push(child);
    else if (child.props.children) rows.push(...getRows(child.props.children));
  }
  return rows;
}

function getCells(row: ReactElement<MarkdownNodeProps>): ReactElement<MarkdownNodeProps>[] {
  const children = row.props.children;
  const arr = Array.isArray(children) ? children : [children];
  return arr.filter((c): c is ReactElement<MarkdownNodeProps> => {
    if (!isMarkdownElement(c)) return false;
    const tag = getTag(c);
    return tag === 'th' || tag === 'td';
  });
}

const ResponsiveTable = ({ children }: { children: ReactNode }) => {
  const arr = Array.isArray(children) ? children : [children];
  let headerRow: ReactElement<MarkdownNodeProps> | null = null;
  const bodyRows: ReactElement<MarkdownNodeProps>[] = [];
  for (const section of arr) {
    if (!isMarkdownElement(section)) continue;
    const tag = getTag(section);
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
            <div key={i} className="rounded-md border border-border bg-card text-card-foreground p-2 shadow-sm">
              {cells.map((cell, j) => {
                const label = headers[j] || `Campo ${j + 1}`;
                const value = extractText(cell).trim();
                if (!value || value === '-') return null;
                return (
                  <div key={j} className="flex gap-2 py-0.5 border-b border-border/40 last:border-0">
                    <span className="text-data font-semibold text-muted-foreground uppercase tracking-wide shrink-0 w-[35%]">
                      {label}
                    </span>
                    <span className="text-label text-foreground/90 flex-1 break-words">
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
      <div className="hidden sm:block my-2 -mx-1 overflow-x-auto rounded-md border border-border bg-card text-card-foreground">
        <table className="w-full border-collapse text-label">{children}</table>
      </div>
    </>
  );
};

export const GlobalAIChatDialog = ({ open, onOpenChange }: GlobalAIChatDialogProps) => {
  const { properties } = useProperties();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPinging, setIsPinging] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // NOTA: NÃO buscamos mais balancete/properties pré-formatados pra
  // mandar pro backend. O `chat-ia` faz tool calling e busca direto
  // do Supabase via JWT do usuário. Se você está mexendo aqui pra
  // re-adicionar contexto pré-montado, provavelmente é melhor adicionar
  // uma tool nova em `supabase/functions/chat-ia/index.ts`.

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const result = await chatIa({ messages: newMessages });
      if (!result.content) {
        setMessages([...newMessages, { role: 'assistant', content: 'Sem resposta da IA.' }]);
      } else {
        setMessages([...newMessages, { role: 'assistant', content: result.content }]);
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

  const handlePing = async () => {
    if (isPinging) return;
    setIsPinging(true);
    const result = await pingChatIa();
    if (result.severity === 'success') toast.success(result.message);
    else if (result.severity === 'warning') toast.warning(result.message);
    else toast.error(result.message);
    setIsPinging(false);
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
              <Bot className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="truncate">Consultor IA</span>
          </DialogTitle>
          <div className="flex items-center justify-between gap-2">
            <p className="text-data sm:text-label text-muted-foreground truncate">
              Pergunte sobre seus imóveis, balancete, ITBI, rentabilidade...
            </p>
            <Button
              onClick={handlePing}
              disabled={isPinging}
              variant="ghost"
              size="sm"
              className="h-7 shrink-0 px-2 text-meta"
              title="Testa se o backend chat-ia está deployado e a chave OpenAI configurada"
            >
              {isPinging ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Zap className="h-3 w-3 mr-1" />
              )}
              {isPinging ? 'Testando...' : 'Testar'}
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-hidden" ref={scrollRef}>
          <ScrollArea className="h-full px-3 sm:px-6 py-3 sm:py-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-8 sm:py-12">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-3">
                  <Bot className="h-7 w-7 text-primary" />
                </div>
                <p className="text-sm mb-2">Tenho acesso aos seus {properties.length} imóveis, balancete, ITBI e estimativas IA.</p>
                <p className="text-label text-muted-foreground px-4">
                  Ex: "Qual imóvel está dando mais prejuízo?", "Onde tá custo inflado?", "Compara meus apartamentos por yield."
                </p>
              </div>
            )}
            <div className="space-y-3 sm:space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-2 sm:gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                  {msg.role === 'assistant' && (
                    <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shrink-0 mt-1">
                      <Bot className="h-3.5 w-3.5 text-primary-foreground" />
                    </div>
                  )}
                  <div className={`rounded-xl px-3 sm:px-4 py-2 sm:py-3 ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground max-w-[85%]'
                      : 'bg-secondary max-w-[92%] sm:max-w-[88%] w-full'
                  }`}>
                    {msg.role === 'assistant' ? (
                      <div className="text-data leading-relaxed space-y-2 [&_p]:my-1 [&_h1]:text-sm [&_h1]:font-bold [&_h1]:mt-3 [&_h1]:mb-1 [&_h2]:text-data [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1 [&_h3]:text-data [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:my-0.5 [&_strong]:font-semibold [&_code]:bg-background/60 [&_code]:px-1 [&_code]:rounded [&_code]:text-label">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            table: ({ children }) => (
                              <ResponsiveTable>{children}</ResponsiveTable>
                            ),
                            thead: ({ node, ...props }) => (
                              <thead className="bg-card border-b border-border" {...props} />
                            ),
                            tr: ({ node, ...props }) => (
                              <tr className="border-b border-border last:border-0 bg-card" {...props} />
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
                      <p className="text-data whitespace-pre-wrap">{msg.content}</p>
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
                    <Bot className="h-3.5 w-3.5 text-primary-foreground animate-pulse" />
                  </div>
                  <div className="bg-secondary rounded-xl px-4 py-3 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span className="text-label text-muted-foreground">Pensando...</span>
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
