import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles } from "lucide-react";
import { convertMarkdownToHtml } from "@/lib/markdown-render";

interface DialogAnaliseIaProps {
  markdown: string | null;
  onClose: () => void;
}

/**
 * Modal que renderiza a análise completa do GPT em markdown. Aberto
 * pelo `<CardResultado>` quando o ponto vem da fonte `estimativa_ia`,
 * ou pelo `<CardResumoFonte>` da IA via "Ver análise completa →".
 *
 * O HTML é injetado via `dangerouslySetInnerHTML` porque o conversor
 * já escapa entidades — ver `convertMarkdownToHtml` em `lib/markdown-render`.
 */
export function DialogAnaliseIa({ markdown, onClose }: DialogAnaliseIaProps) {
  const html = useMemo(
    () => (markdown ? convertMarkdownToHtml(markdown) : ""),
    [markdown],
  );

  return (
    <Dialog open={markdown !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[min(96vw,1100px)] max-w-5xl max-h-[88vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b bg-card">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            Análise de mercado — IA
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 px-6 py-5">
          {markdown ? (
            <div
              className="space-y-3"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhuma análise disponível. Clique em "Atualizar tudo" no topo da
              seção para gerar uma agora.
            </p>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
