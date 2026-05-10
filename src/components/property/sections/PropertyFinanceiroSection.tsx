import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, FileText, Key, TrendingUp } from "lucide-react";
import { fmtBRL, fmtBRLCompact } from "@/lib/format";
import {
  custoMensalTotal,
  fmtYield,
  rendaMensalLiquida,
  yieldBrutoAnual,
  yieldLiquidoAnual,
} from "@/lib/property-financials";
import type { Property } from "@/types/property";

type FinanceiroProperty = Pick<
  Property,
  | "market_value"
  | "declared_value"
  | "iptu_value"
  | "iptu_pago"
  | "valor_condominio"
  | "alugado"
  | "valor_aluguel"
  | "inquilino"
>;

interface PropertyFinanceiroSectionProps {
  property: FinanceiroProperty;
}

/**
 * Seção "Financeiro" da página de detalhes — fundiu os ex-cards
 * Valores + Custos + Renda em três colunas, e adicionou uma faixa
 * de DERIVADOS calculados automaticamente (yield bruto/líquido,
 * custo mensal total, renda líquida).
 *
 * Tudo derivado vive em `@/lib/property-financials` (puro,
 * testável). Esse componente só apresenta.
 */
export function PropertyFinanceiroSection({
  property,
}: PropertyFinanceiroSectionProps) {
  const yieldBruto = yieldBrutoAnual(property);
  const yieldLiquido = yieldLiquidoAnual(property);
  const custoMensal = custoMensalTotal(property);
  const rendaLiquida = rendaMensalLiquida(property);

  const temDerivados =
    yieldBruto != null ||
    yieldLiquido != null ||
    custoMensal != null ||
    rendaLiquida != null;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Valores */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-[13px] font-medium tracking-[0.16em] uppercase text-muted-foreground">
              <DollarSign className="h-3.5 w-3.5 text-primary" />
              Valores
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            <Linha
              rotulo="Mercado"
              valor={fmtOrDash(property.market_value)}
              destaque
            />
            <Linha
              rotulo="Declarado"
              valor={fmtOrDash(property.declared_value)}
            />
          </CardContent>
        </Card>

        {/* Custos */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-[13px] font-medium tracking-[0.16em] uppercase text-muted-foreground">
              <FileText className="h-3.5 w-3.5 text-primary" />
              Custos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            <div className="flex items-center justify-between rounded-md bg-secondary px-2.5 py-1.5">
              <span className="text-[12px] text-muted-foreground">
                IPTU (mensal)
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-normal">
                  {fmtOrDash(property.iptu_value)}
                </span>
                {property.iptu_pago ? (
                  <Badge
                    variant="outline"
                    className="border-success text-[13px] font-medium text-success"
                  >
                    Pago
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="border-warning text-[13px] font-medium text-warning"
                  >
                    Pendente
                  </Badge>
                )}
              </div>
            </div>
            <Linha
              rotulo="Condomínio"
              valor={
                property.valor_condominio
                  ? `${fmtBRL(property.valor_condominio)}/mês`
                  : "—"
              }
            />
          </CardContent>
        </Card>

        {/* Renda */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-[13px] font-medium tracking-[0.16em] uppercase text-muted-foreground">
              <Key className="h-3.5 w-3.5 text-primary" />
              Renda
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            <Linha
              rotulo="Status"
              valor={property.alugado ? "Alugado" : "Não alugado"}
              valorClassName={property.alugado ? "text-info" : ""}
            />
            <Linha
              rotulo="Aluguel"
              valor={
                property.valor_aluguel
                  ? `${fmtBRL(property.valor_aluguel)}/mês`
                  : "—"
              }
              valorClassName={
                property.alugado && property.valor_aluguel ? "text-info" : ""
              }
            />
            {property.alugado && property.inquilino ? (
              <div className="flex items-center justify-between rounded-md bg-info/10 px-2.5 py-1.5">
                <span className="text-[12px] text-muted-foreground">
                  Inquilino
                </span>
                <span className="text-[12px] font-normal">
                  {property.inquilino}
                </span>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* Derivados — só renderiza se houver pelo menos um cálculo possível */}
      {temDerivados ? (
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-[13px] font-medium tracking-[0.16em] uppercase text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
              Indicadores derivados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Derivado
                rotulo="Yield bruto"
                valor={fmtYield(yieldBruto)}
                ajuda="Aluguel × 12 ÷ valor de mercado"
              />
              <Derivado
                rotulo="Yield líquido"
                valor={fmtYield(yieldLiquido)}
                ajuda="(Aluguel − IPTU − condomínio) × 12 ÷ valor"
                negativo={yieldLiquido != null && yieldLiquido < 0}
              />
              <Derivado
                rotulo="Custo mensal"
                valor={
                  custoMensal != null
                    ? `${fmtBRLCompact(custoMensal)}/mês`
                    : "—"
                }
                ajuda="IPTU + condomínio"
              />
              <Derivado
                rotulo="Renda líquida"
                valor={
                  rendaLiquida != null
                    ? `${fmtBRLCompact(rendaLiquida)}/mês`
                    : "—"
                }
                ajuda="Aluguel − IPTU − condomínio"
                negativo={rendaLiquida != null && rendaLiquida < 0}
              />
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

// ─── building blocks ─────────────────────────────────────────────────

function Linha({
  rotulo,
  valor,
  destaque,
  valorClassName,
}: {
  rotulo: React.ReactNode;
  valor: React.ReactNode;
  destaque?: boolean;
  valorClassName?: string;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-md px-2.5 py-1.5 ${
        destaque ? "bg-primary/10" : "bg-secondary"
      }`}
    >
      <span className="text-[12px] text-muted-foreground">{rotulo}</span>
      <span
        className={`text-[12px] font-normal ${destaque ? "text-primary" : ""} ${valorClassName ?? ""}`}
      >
        {valor}
      </span>
    </div>
  );
}

function Derivado({
  rotulo,
  valor,
  ajuda,
  negativo,
}: {
  rotulo: string;
  valor: string;
  ajuda?: string;
  negativo?: boolean;
}) {
  return (
    <div
      className="flex flex-col gap-0.5 rounded-md bg-background/60 p-2.5"
      title={ajuda}
    >
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {rotulo}
      </span>
      <span
        className={`text-base font-semibold tabular-nums ${
          negativo ? "text-destructive" : "text-foreground"
        }`}
      >
        {valor}
      </span>
    </div>
  );
}

/** Igual ao `formatCurrency` antigo — devolve `—` se valor inválido. */
function fmtOrDash(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return fmtBRL(value);
}
