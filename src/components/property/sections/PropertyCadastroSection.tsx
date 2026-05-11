import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Bath,
  BedDouble,
  Building,
  Car,
  Home,
  Ruler,
} from "lucide-react";
import type { Property } from "@/types/property";

type CadastroProperty = Pick<
  Property,
  | "tipo_imovel"
  | "proprietario_papel"
  | "proprietario_matricula"
  | "proprietario_matricula_ii"
  | "percentual_proprietario_matricula"
  | "percentual_proprietario_matricula_ii"
  | "numero_matricula"
  | "numero_contribuinte"
  | "quartos"
  | "suites"
  | "banheiros"
  | "garagens"
  | "metragem"
  | "area_comum"
  | "area_total"
>;

interface PropertyCadastroSectionProps {
  property: CadastroProperty;
}

/**
 * Seção "Cadastro" da página de detalhes — fundiu os ex-cards
 * Propriedade + Características + Metragens em duas colunas
 * nomeadas (Identificação + Atributos físicos). Mantém todos os
 * campos cadastrais em um lugar só, hierarquizado.
 */
export function PropertyCadastroSection({
  property,
}: PropertyCadastroSectionProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-1.5 text-data font-medium tracking-[0.16em] uppercase text-muted-foreground">
            <Building className="h-3.5 w-3.5 text-primary" />
            Identificação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          <Linha
            rotulo="Tipo"
            valor={property.tipo_imovel || "Apartamento"}
            valorClassName="capitalize"
          />
          <Linha
            rotulo="Proprietário (papel)"
            valor={abreviarProprietario(property.proprietario_papel)}
          />
          <Linha
            rotulo="Proprietário (matrícula)"
            valor={
              <>
                {abreviarProprietario(property.proprietario_matricula)}
                {property.percentual_proprietario_matricula != null &&
                property.percentual_proprietario_matricula !== 100 ? (
                  <span className="ml-1 text-muted-foreground">
                    ({property.percentual_proprietario_matricula}%)
                  </span>
                ) : null}
              </>
            }
          />
          {property.proprietario_matricula_ii ? (
            <Linha
              rotulo="Proprietário 2 (matrícula)"
              valor={
                <>
                  {abreviarProprietario(property.proprietario_matricula_ii)}
                  {property.percentual_proprietario_matricula_ii != null &&
                  property.percentual_proprietario_matricula_ii > 0 ? (
                    <span className="ml-1 text-muted-foreground">
                      ({property.percentual_proprietario_matricula_ii}%)
                    </span>
                  ) : null}
                </>
              }
            />
          ) : null}
          <Linha
            rotulo="Nº matrícula"
            valor={property.numero_matricula || "—"}
            valorClassName="font-mono"
          />
          <Linha
            rotulo="Nº contribuinte"
            valor={property.numero_contribuinte || "—"}
            valorClassName="font-mono"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-1.5 text-data font-medium tracking-[0.16em] uppercase text-muted-foreground">
            <Home className="h-3.5 w-3.5 text-primary" />
            Atributos físicos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Quantidades de cômodos com ícones — visualmente leve. */}
          <div className="grid grid-cols-2 gap-1.5">
            <Quadrante
              icone={<BedDouble className="h-3 w-3 text-muted-foreground" />}
              rotulo="Quartos"
              valor={property.quartos ?? "—"}
            />
            <Quadrante
              icone={<BedDouble className="h-3 w-3 text-muted-foreground" />}
              rotulo="Suítes"
              valor={property.suites ?? "—"}
            />
            <Quadrante
              icone={<Bath className="h-3 w-3 text-muted-foreground" />}
              rotulo="Banheiros"
              valor={property.banheiros ?? "—"}
            />
            <Quadrante
              icone={<Car className="h-3 w-3 text-muted-foreground" />}
              rotulo="Garagens"
              valor={property.garagens ?? "—"}
            />
          </div>

          {/* Metragens — separadas por divisor. */}
          <div className="space-y-1.5 border-t border-border/60 pt-3">
            <Linha
              rotulo={
                <span className="flex items-center gap-1.5">
                  <Ruler className="h-3 w-3" />
                  Área útil
                </span>
              }
              valor={property.metragem ? `${property.metragem} m²` : "—"}
            />
            <Linha
              rotulo="Área comum"
              valor={property.area_comum ? `${property.area_comum} m²` : "—"}
            />
            <Linha
              rotulo="Área total"
              valor={property.area_total ? `${property.area_total} m²` : "—"}
              destaque
            />
          </div>
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
        className={`text-label font-normal ${
          destaque ? "text-primary" : ""
        } ${valorClassName ?? ""}`}
      >
        {valor}
      </span>
    </div>
  );
}

function Quadrante({
  icone,
  rotulo,
  valor,
}: {
  icone: React.ReactNode;
  rotulo: string;
  valor: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-secondary p-3">
      <div className="flex items-center gap-2">
        {icone}
        <span className="text-label text-muted-foreground">{rotulo}</span>
      </div>
      <span className="text-label font-normal">{valor}</span>
    </div>
  );
}

function abreviarProprietario(name: string | null | undefined): string {
  if (!name) return "—";
  if (name.toUpperCase().includes("DV")) return "DV";
  return name;
}
