import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Database, Search, Pencil, MapPin } from "lucide-react";
import { AnalisePreco } from "@/components/analise-preco/AnalisePreco";
import type { Property } from "@/types/property";

// ─── public surface ──────────────────────────────────────────────────

const TIPOS = [
  { value: "apartamento", label: "Apartamento" },
  { value: "casa", label: "Casa" },
  { value: "terreno", label: "Terreno" },
  { value: "conjunto_comercial", label: "Conjunto comercial" },
  { value: "garagem", label: "Garagem / Vaga" },
] as const;

interface SearchFields {
  tipo_imovel: string;
  rua: string;
  numero: string;
  bairro: string;
  cep: string;
  cidade: string;
  estado: string;
  quartos: string;
  metragem: string;
}

const INITIAL: SearchFields = {
  tipo_imovel: "apartamento",
  rua: "",
  numero: "",
  bairro: "",
  cep: "",
  cidade: "São Paulo",
  estado: "SP",
  quartos: "",
  metragem: "",
};

/**
 * Página standalone de pesquisa pontual de preços. Entra com endereço
 * + tipo + características, sai com a mesma seção `<AnalisePreco>` que
 * a aba "Ver detalhes" mostra para imóveis cadastrados — mesmas fontes
 * (ITBI, Anúncios ZAP, Estimativa IA), mesmos charts, cards e filtros.
 *
 * Diferença vs. cadastrado: nenhuma persistência. O `Property` montado
 * a partir do form não tem `id`, então os adapters (`useDadosItbi`,
 * `useDadosEstimativaIa`) já tratam graciosamente — buscam dados,
 * mostram, mas não escrevem cache no banco.
 */
export default function ItbiSearch() {
  // null = mostrando form; objeto = mostrando AnalisePreco com aquela busca
  const [submitted, setSubmitted] = useState<Property | null>(null);

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto space-y-4 px-3 py-4 sm:px-4 sm:py-6">
        <div>
          <h1 className="font-display flex items-center gap-2 text-xl font-semibold sm:text-2xl">
            <Database className="h-5 w-5 text-primary" />
            Pesquisa pontual de preço
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Mesma análise da aba "Ver detalhes" (ITBI + Anúncios ZAP +
            Estimativa IA) sem precisar cadastrar o imóvel.
          </p>
        </div>

        {submitted ? (
          <>
            <SearchSummary
              property={submitted}
              onEdit={() => setSubmitted(null)}
            />
            <AnalisePreco property={submitted} />
          </>
        ) : (
          <SearchForm onSubmit={setSubmitted} initial={INITIAL} />
        )}
      </main>
    </div>
  );
}

// ─── form ────────────────────────────────────────────────────────────

function SearchForm({
  initial,
  onSubmit,
}: {
  initial: SearchFields;
  onSubmit: (p: Property) => void;
}) {
  const [fields, setFields] = useState<SearchFields>(initial);

  const update = (key: keyof SearchFields, value: string) =>
    setFields((prev) => ({ ...prev, [key]: value }));

  // Pelo menos rua OU bairro precisa estar preenchido — sem isso ITBI/
  // ZAP não conseguem filtrar a área e a busca devolveria ruído. As
  // outras fontes (IA) seriam imprecisas também.
  const hasMinimo = fields.rua.trim() !== "" || fields.bairro.trim() !== "";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasMinimo) return;
    onSubmit(buildSyntheticProperty(fields));
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">
            Dados do imóvel
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Linha 1: tipo + endereço */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="itbi-tipo" className="text-sm">
                Tipo de imóvel
              </Label>
              <Select
                value={fields.tipo_imovel}
                onValueChange={(v) => update("tipo_imovel", v)}
              >
                <SelectTrigger id="itbi-tipo" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 sm:col-span-3">
              <Label htmlFor="itbi-rua" className="text-sm">
                Rua / Logradouro
              </Label>
              <Input
                id="itbi-rua"
                value={fields.rua}
                onChange={(e) => update("rua", e.target.value)}
                placeholder="Ex: Rua Pio XI"
                className="h-9"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="itbi-numero" className="text-sm">
                Número
              </Label>
              <Input
                id="itbi-numero"
                value={fields.numero}
                onChange={(e) => update("numero", e.target.value)}
                placeholder="Ex: 1856"
                className="h-9"
                inputMode="numeric"
              />
            </div>
          </div>

          {/* Linha 2: localização */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="itbi-bairro" className="text-sm">
                Bairro
              </Label>
              <Input
                id="itbi-bairro"
                value={fields.bairro}
                onChange={(e) => update("bairro", e.target.value)}
                placeholder="Ex: Alto de Pinheiros"
                className="h-9"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="itbi-cidade" className="text-sm">
                Cidade
              </Label>
              <Input
                id="itbi-cidade"
                value={fields.cidade}
                onChange={(e) => update("cidade", e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="itbi-estado" className="text-sm">
                Estado
              </Label>
              <Input
                id="itbi-estado"
                value={fields.estado}
                onChange={(e) => update("estado", e.target.value.toUpperCase())}
                maxLength={2}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="itbi-cep" className="text-sm">
                CEP
              </Label>
              <Input
                id="itbi-cep"
                value={fields.cep}
                onChange={(e) => update("cep", e.target.value)}
                placeholder="Opcional"
                className="h-9"
                inputMode="numeric"
              />
            </div>
          </div>

          {/* Linha 3: características — refinam ITBI/ZAP/IA */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="itbi-quartos" className="text-sm">
                Quartos
              </Label>
              <Input
                id="itbi-quartos"
                value={fields.quartos}
                onChange={(e) =>
                  update("quartos", e.target.value.replace(/\D/g, ""))
                }
                placeholder="Ex: 3"
                className="h-9"
                inputMode="numeric"
                maxLength={2}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="itbi-metragem" className="text-sm">
                Área útil (m²)
              </Label>
              <Input
                id="itbi-metragem"
                value={fields.metragem}
                onChange={(e) =>
                  update("metragem", e.target.value.replace(/[^\d.]/g, ""))
                }
                placeholder="Ex: 83"
                className="h-9"
                inputMode="decimal"
              />
            </div>
            <div className="flex items-end sm:col-span-2">
              <Button
                type="submit"
                disabled={!hasMinimo}
                className="h-9 w-full"
              >
                <Search className="mr-2 h-4 w-4" />
                Analisar preço
              </Button>
            </div>
          </div>

          <p className="text-[12px] text-muted-foreground">
            Mínimo: rua ou bairro. Quanto mais campos preenchidos, mais
            preciso o filtro de comparáveis (especialmente metragem e
            quartos pra os anúncios).
          </p>
        </CardContent>
      </Card>
    </form>
  );
}

// ─── summary (após submit) ───────────────────────────────────────────

function SearchSummary({
  property,
  onEdit,
}: {
  property: Property;
  onEdit: () => void;
}) {
  const linhaEndereco = [
    property.rua,
    property.numero,
    property.bairro,
    `${property.cidade} - ${property.estado}`,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Card>
      <CardContent className="flex flex-col items-start justify-between gap-3 py-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
            <MapPin className="h-3 w-3" />
            Pesquisando
          </div>
          <p className="mt-0.5 truncate text-sm font-medium">{linhaEndereco}</p>
          <div className="mt-0.5 flex flex-wrap gap-x-3 text-[12px] text-muted-foreground">
            <span className="capitalize">
              {property.tipo_imovel?.replace("_", " ") ?? "—"}
            </span>
            {property.quartos ? <span>{property.quartos} quartos</span> : null}
            {property.metragem ? <span>{property.metragem} m²</span> : null}
          </div>
        </div>
        <Button onClick={onEdit} variant="outline" size="sm" className="h-8">
          <Pencil className="mr-1.5 h-3.5 w-3.5" />
          Editar busca
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────

/**
 * Converte o form numa `Property` sintética. Não tem `id` — os
 * adapters da `<AnalisePreco>` checam isso e pulam persistência.
 * Campos não preenchidos viram `undefined`/`null` conforme o tipo
 * espera; nada que cause runtime error.
 */
function buildSyntheticProperty(f: SearchFields): Property {
  const numeroOrUndef = (s: string) => {
    const trimmed = s.trim();
    if (!trimmed) return undefined;
    const n = Number(trimmed);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };

  return {
    // `id` vazio sinaliza pros adapters "não persiste". Mantém a
    // estrutura do tipo Property satisfeita.
    id: "",
    estado: f.estado.trim() || "SP",
    cidade: f.cidade.trim() || "São Paulo",
    bairro: f.bairro.trim(),
    rua: f.rua.trim(),
    numero: f.numero.trim() || null,
    declared_value: 0,
    numero_matricula: "",
    market_value: 0,
    iptu_value: 0,
    photos: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    iptu_pago: false,
    proprietario_papel: "",
    proprietario_matricula: "",
    user_id: "",
    validado: false,
    vendido: false,
    alugado: false,
    tipo_imovel: f.tipo_imovel,
    quartos: numeroOrUndef(f.quartos),
    metragem: numeroOrUndef(f.metragem),
    cep: f.cep.trim() || null,
    // restante usa default do tipo (undefined / null)
  };
}
