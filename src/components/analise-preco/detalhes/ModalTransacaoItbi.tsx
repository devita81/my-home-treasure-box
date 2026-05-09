import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fmtBRL, fmtDate } from "@/lib/format";
import { type ItbiResult } from "@/components/itbi/itbi-stats";

interface ModalTransacaoItbiProps {
  transacao: ItbiResult | null;
  onClose: () => void;
}

/**
 * Modal de detalhes de uma transação ITBI. Aberto pelo `<CardResultado>`
 * quando a fonte do ponto é `itbi`. Conteúdo idêntico ao ex-
 * `ItbiTransactionDetails` — só envelopado em `<Dialog>` para que a
 * `<GradeResultados>` não precise saber controlar o estado de modal
 * para cada fonte separadamente.
 */
export function ModalTransacaoItbi({
  transacao,
  onClose,
}: ModalTransacaoItbiProps) {
  return (
    <Dialog
      open={transacao !== null}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Detalhes da transação ITBI</DialogTitle>
        </DialogHeader>
        {transacao ? <Conteudo transacao={transacao} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function Conteudo({ transacao }: { transacao: ItbiResult }) {
  const fullAddress = [transacao.logradouro, transacao.numero, transacao.complemento]
    .filter(Boolean)
    .join(", ");

  const fields: Array<{ label: string; value: string }> = [
    { label: "Endereço", value: fullAddress || "—" },
    { label: "Bairro", value: transacao.bairro ?? "—" },
    { label: "CEP", value: transacao.cep ?? "—" },
    {
      label: "Área construída",
      value:
        transacao.area_construida != null
          ? `${transacao.area_construida} m²`
          : "—",
    },
    { label: "Valor venal", value: fmtBRL(transacao.valor_venal) },
    { label: "SQL / IPTU", value: transacao.sql_iptu ?? "—" },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/40 p-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Transação em {fmtDate(transacao.data_transacao)}
        </p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">
          {fmtBRL(transacao.valor_transacao)}
        </p>
      </div>

      <dl className="grid grid-cols-3 gap-x-3 gap-y-2 text-sm">
        {fields.map((f) => (
          <div key={f.label} className="contents">
            <dt className="text-muted-foreground">{f.label}</dt>
            <dd className="col-span-2 break-words text-foreground">{f.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
