import { Link } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  DollarSign,
  FileText,
  Key,
  Loader2,
  TrendingUp,
} from "lucide-react";
import { fmtBRL, fmtBRLCompact, fmtDate } from "@/lib/format";
import { fmtYield, yieldBrutoAnual, yieldLiquidoFromMedia } from "@/lib/property-financials";
import { useReceitaLiquidaImovel } from "@/hooks/useReceitaLiquidaImovel";
import type { Property } from "@/types/property";

type FinanceiroProperty = Pick<
  Property,
  | "id"
  | "market_value"
  | "declared_value"
  | "iptu_value"
  | "iptu_pago"
  | "valor_condominio"
  | "alugado"
  | "valor_aluguel"
  | "inquilino"
  | "taxa_administracao"
>;

interface PropertyFinanceiroSectionProps {
  property: FinanceiroProperty;
}

/**
 * Seção "Financeiro" da página de detalhes — três colunas (Valores +
 * Custos + Renda) e uma faixa de "Indicadores derivados".
 *
 * Indicadores derivados puxam a média mensal real do `Balancete`
 * (view `property_balancete`), via `useReceitaLiquidaImovel`. Os
 * cálculos antigos baseados em `aluguel - iptu - condomínio`
 * estavam errados conceitualmente (o inquilino reembolsa IPTU e
 * condomínio) e foram trocados pela média real de receita líquida.
 *
 * Yield BRUTO continua sendo cálculo cadastral (aluguel × 12 / valor).
 */
export function PropertyFinanceiroSection({
  property,
}: PropertyFinanceiroSectionProps) {
  const yieldBruto = yieldBrutoAnual(property);
  const balancete = useReceitaLiquidaImovel(property.id);
  const { resumo } = balancete;
  const temReceita = resumo.meses > 0;
  const yieldLiquido = temReceita
    ? yieldLiquidoFromMedia(resumo.liquidoMedio, property.market_value)
    : null;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Valores */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-data font-medium tracking-[0.16em] uppercase text-muted-foreground">
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

        {/* Custos cadastrais — IPTU e condomínio ficam aqui só pra
            referência. Em locação residencial são reembolsados pelo
            inquilino, então não impactam a receita líquida (ver card
            de derivados abaixo). */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-data font-medium tracking-[0.16em] uppercase text-muted-foreground">
              <FileText className="h-3.5 w-3.5 text-primary" />
              Custos cadastrais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            <div className="flex items-center justify-between rounded-md bg-secondary px-2.5 py-1.5">
              <span className="text-label text-muted-foreground">IPTU</span>
              <div className="flex items-center gap-2">
                <span className="text-label font-normal">
                  {property.iptu_value
                    ? `${fmtBRL(property.iptu_value)}/mês`
                    : "—"}
                </span>
                {property.iptu_pago ? (
                  <Badge
                    variant="outline"
                    className="border-success text-data font-medium text-success"
                  >
                    Pago
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="border-warning text-data font-medium text-warning"
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
            <Linha
              rotulo="Taxa de admin."
              valor={
                property.taxa_administracao
                  ? `${fmtBRL(property.taxa_administracao)}/mês`
                  : "—"
              }
            />
          </CardContent>
        </Card>

        {/* Renda */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-data font-medium tracking-[0.16em] uppercase text-muted-foreground">
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
                <span className="text-label text-muted-foreground">
                  Inquilino
                </span>
                <span className="text-label font-normal">
                  {property.inquilino}
                </span>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* Indicadores derivados — usa a média mensal real do Balancete
          (mesma fonte da aba Balancete) para receita / despesa /
          líquido. Yield bruto vem dos campos cadastrais. */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-1.5 text-data font-medium tracking-[0.16em] uppercase text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5 text-primary" />
            Indicadores derivados
          </CardTitle>
          {temReceita ? (
            <span className="text-meta text-muted-foreground">
              Médias de {resumo.meses}{" "}
              {resumo.meses === 1 ? "mês" : "meses"}
              {resumo.desde && resumo.ate
                ? ` (${fmtDate(resumo.desde)} – ${fmtDate(resumo.ate)})`
                : ""}
            </span>
          ) : null}
        </CardHeader>
        <CardContent>
          {balancete.isLoading ? (
            <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Carregando movimentação do Balancete…
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Derivado
                  rotulo="Yield bruto"
                  valor={fmtYield(yieldBruto)}
                  ajuda="Aluguel cadastrado × 12 ÷ valor de mercado"
                />
                <Derivado
                  rotulo="Yield líquido"
                  valor={fmtYield(yieldLiquido)}
                  ajuda="Receita líquida média (Balancete) × 12 ÷ valor"
                  negativo={yieldLiquido != null && yieldLiquido < 0}
                />
                <Derivado
                  rotulo="Receita média"
                  valor={
                    temReceita
                      ? `${fmtBRLCompact(resumo.receitaMedia)}/mês`
                      : "—"
                  }
                  ajuda="Aluguel + reembolsos (média mensal) — fonte: Balancete"
                />
                <Derivado
                  rotulo="Líquido médio"
                  valor={
                    temReceita
                      ? `${fmtBRLCompact(resumo.liquidoMedio)}/mês`
                      : "—"
                  }
                  ajuda="Receita − despesa (média mensal) — fonte: Balancete"
                  negativo={temReceita && resumo.liquidoMedio < 0}
                />
              </div>
              {!temReceita && !balancete.isError ? (
                <p className="mt-3 text-label text-muted-foreground">
                  Sem lançamentos no Balancete para este imóvel — apenas
                  o yield bruto pode ser estimado a partir do aluguel
                  cadastrado.
                </p>
              ) : null}
              {balancete.isError ? (
                <p className="mt-3 text-label text-destructive">
                  Falha ao buscar movimentação do Balancete.
                </p>
              ) : null}
              {temReceita ? (
                <Link
                  to="/balancete"
                  className="mt-3 inline-flex items-center gap-1 text-label text-primary underline-offset-4 hover:underline"
                >
                  Ver detalhes mês a mês no Balancete
                  <ArrowRight className="h-3 w-3" />
                </Link>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
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
      <span className="text-label text-muted-foreground">{rotulo}</span>
      <span
        className={`text-label font-normal ${destaque ? "text-primary" : ""} ${valorClassName ?? ""}`}
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
      <span className="text-nano uppercase tracking-wide text-muted-foreground">
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
