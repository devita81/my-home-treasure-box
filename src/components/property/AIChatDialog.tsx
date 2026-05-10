import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Loader2, Bot, User, Zap } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import { chatIa, pingChatIa, type ChatMessage } from '@/lib/ai-chat';

interface AIChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * UUID do imóvel sendo consultado. Quando passado, o backend injeta
   * um system message focando esse imóvel — o modelo começa puxando
   * `get_property_detail(propertyId)` antes de responder.
   *
   * Substitui o antigo `propertyContext: string` que vinha pré-formatado
   * do PropertyDetails.tsx — agora todo contexto é via tool calling.
   */
  propertyId?: string;
}

export const AIChatDialog = ({ open, onOpenChange, propertyId }: AIChatDialogProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPinging, setIsPinging] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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
      const result = await chatIa({ messages: newMessages, propertyId });
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
          className="px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4 border-b shrink-0 pr-12"
          style={{ paddingTop: 'max(0.75rem, calc(env(safe-area-inset-top) + 0.5rem))' }}
        >
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Consultor IA
          </DialogTitle>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[12px] text-muted-foreground truncate">
              Pergunte sobre este imóvel — balancete, ITBI, comparáveis, estimativas
            </p>
            <Button
              onClick={handlePing}
              disabled={isPinging}
              variant="ghost"
              size="sm"
              className="h-7 shrink-0 px-2 text-[11px]"
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

        <div className="flex-1 overflow-hidden" ref={scrollRef}>
          <ScrollArea className="h-full px-6 py-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-12">
                <Bot className="h-12 w-12 mb-4 opacity-30" />
                <p className="text-sm">Faça qualquer pergunta sobre este imóvel.</p>
              </div>
            )}
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                  {msg.role === 'assistant' && (
                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div className={`rounded-xl px-4 py-3 max-w-[85%] ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary'
                  }`}>
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none text-[13px]">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-[13px] whitespace-pre-wrap">{msg.content}</p>
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
                <div className="flex gap-3">
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot className="h-4 w-4 text-primary animate-pulse" />
                  </div>
                  <div className="bg-secondary rounded-xl px-4 py-3 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span className="text-[12px] text-muted-foreground">Pensando...</span>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        <div className="border-t px-6 py-4">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite sua pergunta..."
              className="resize-none min-h-[44px] max-h-[120px]"
              style={{ fontSize: '16px' }}
              rows={1}
            />
            <Button onClick={sendMessage} disabled={!input.trim() || isLoading} size="icon" className="shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
