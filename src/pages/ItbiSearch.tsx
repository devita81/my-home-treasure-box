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
import { AddressAutocompleteInput } from "@/components/ui/address-autocomplete-input";
import { searchAddresses } from "@/lib/nominatim";
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
  // Lat/lon — CRÍTICOS pra qualidade da busca ZAP. A edge function
  // fetch-zap-listings faz busca geo-localizada quando tem lat/lon, e
  // cai em busca textual fraca quando não tem. Sem isso, o mesmo
  // endereço cadastrado em /add devolve 8 comparáveis precisos e na
  // /itbi-search avulsa devolve 0 ou 8 dispersos.
  //
  // Populados via 2 caminhos:
  //  1. Autocomplete (Nominatim) — usuário clica numa sugestão e
  //     onSelect copia s.lat/s.lon pro estado.
  //  2. Submit fallback — se o user digitou manualmente sem usar o
  //     dropdown, geocodificamos no handleSubmit antes de submeter.
  latitude: number | null;
  longitude: number | null;
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
  latitude: null,
  longitude: null,
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
  // Fields state vive AQUI no parent (não dentro de SearchForm) pra
  // sobreviver ao ciclo de submit → editar. Antes o form era
  // desmontado/remontado e o estado interno zerava — usuário tinha
  // que digitar tudo de novo só pra ajustar um campo.
  const [fields, setFields] = useState<SearchFields>(INITIAL);

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
          <SearchForm
            fields={fields}
            setFields={setFields}
            onSubmit={setSubmitted}
          />
        )}
      </main>
    </div>
  );
}

// ─── form ────────────────────────────────────────────────────────────

function SearchForm({
  fields,
  setFields,
  onSubmit,
}: {
  fields: SearchFields;
  setFields: (updater: (prev: SearchFields) => SearchFields) => void;
  onSubmit: (p: Property) => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  const update = (key: keyof SearchFields, value: string) => {
    // Mexer manualmente em rua/bairro/cidade/estado invalida o lat/lon
    // capturado anteriormente do autocomplete — o endereço mudou e as
    // coords antigas não correspondem mais. O handleSubmit fará um
    // re-geocode se necessário.
    const invalidatesLatLon =
      key === "rua" || key === "bairro" || key === "cidade" || key === "estado";
    setFields((prev) => ({
      ...prev,
      [key]: value,
      ...(invalidatesLatLon ? { latitude: null, longitude: null } : {}),
    }));
  };

  // Pelo menos rua OU bairro precisa estar preenchido — sem isso ITBI/
  // ZAP não conseguem filtrar a área e a busca devolveria ruído. As
  // outras fontes (IA) seriam imprecisas também.
  const hasMinimo = fields.rua.trim() !== "" || fields.bairro.trim() !== "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasMinimo || submitting) return;

    // Se já temos lat/lon (vieram do autocomplete), bora direto.
    // Senão, tenta geocodificar antes de submeter — a edge function
    // fetch-zap-listings faz busca geo-localizada e dá comparáveis MUITO
    // melhores quando recebe coords.
    let resolved = fields;
    if (fields.latitude == null || fields.longitude == null) {
      setSubmitting(true);
      try {
        const query = [
          fields.rua,
          fields.numero,
          fields.bairro,
          fields.cidade,
          fields.estado,
        ]
          .map((s) => s.trim())
          .filter(Boolean)
          .join(", ");
        if (query) {
          const results = await searchAddresses(query, {
            cidade: fields.cidade,
            estado: fields.estado,
          });
          if (results.length > 0) {
            const first = results[0];
            resolved = {
              ...fields,
              latitude: Number.isFinite(first.lat) ? first.lat : null,
              longitude: Number.isFinite(first.lon) ? first.lon : null,
              // Também aproveita o resto se o user deixou em branco —
              // pode acontecer de Nominatim resolver o bairro/cep
              // que o user não preencheu.
              bairro: fields.bairro || first.bairro,
              cep: fields.cep || first.cep,
            };
            // Persiste no estado pra próxima edição não geocodificar de novo
            setFields(resolved);
          }
        }
      } finally {
        setSubmitting(false);
      }
    }

    onSubmit(buildSyntheticProperty(resolved));
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
              <FieldLabel htmlFor="itbi-tipo" variant="optional">
                Tipo de imóvel
              </FieldLabel>
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
              <FieldLabel htmlFor="itbi-rua" variant="required-or-bairro">
                Rua / Logradouro
              </FieldLabel>
              <AddressAutocompleteInput
                id="itbi-rua"
                value={fields.rua}
                onChange={(v) => update("rua", v)}
                onSelect={(s) => {
                  // Selecionar sugestão preenche tudo de uma vez,
                  // INCLUSIVE lat/lon — sem isso, a busca ZAP cai
                  // num fallback textual e devolve resultados ruins
                  // (ver issue v26).
                  setFields((prev) => ({
                    ...prev,
                    rua: s.rua,
                    bairro: s.bairro || prev.bairro,
                    cidade: s.cidade || prev.cidade,
                    estado: s.estado || prev.estado,
                    cep: s.cep || prev.cep,
                    latitude: Number.isFinite(s.lat) ? s.lat : prev.latitude,
                    longitude: Number.isFinite(s.lon) ? s.lon : prev.longitude,
                  }));
                }}
                contextCidade={fields.cidade}
                contextEstado={fields.estado}
                placeholder="Ex: Rua Pio XI"
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <FieldLabel htmlFor="itbi-numero" variant="optional">
                Número
              </FieldLabel>
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
              <FieldLabel htmlFor="itbi-bairro" variant="required-or-rua">
                Bairro
              </FieldLabel>
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
              <FieldLabel htmlFor="itbi-cidade" variant="optional">
                Cidade
              </FieldLabel>
              <Input
                id="itbi-cidade"
                value={fields.cidade}
                onChange={(e) => update("cidade", e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <FieldLabel htmlFor="itbi-estado" variant="optional">
                Estado
              </FieldLabel>
              <Input
                id="itbi-estado"
                value={fields.estado}
                onChange={(e) => update("estado", e.target.value.toUpperCase())}
                maxLength={2}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <FieldLabel htmlFor="itbi-cep" variant="optional">
                CEP
              </FieldLabel>
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
              <FieldLabel htmlFor="itbi-quartos" variant="optional">
                Quartos
              </FieldLabel>
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
              <FieldLabel htmlFor="itbi-metragem" variant="optional">
                Área útil (m²)
              </FieldLabel>
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
                disabled={!hasMinimo || submitting}
                className="h-9 w-full"
              >
                <Search className="mr-2 h-4 w-4" />
                {submitting ? "Localizando..." : "Analisar preço"}
              </Button>
            </div>
          </div>

          <p className="text-label text-muted-foreground">
            <span className="text-destructive">*</span> Preencha rua{" "}
            <span className="font-medium">ou</span> bairro (pelo menos um).
            Demais campos são opcionais — mais campos preenchidos = filtro
            mais preciso (especialmente metragem e quartos pra os anúncios).
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
          <div className="flex items-center gap-1.5 text-meta uppercase tracking-wide text-muted-foreground">
            <MapPin className="h-3 w-3" />
            Pesquisando
          </div>
          <p className="mt-0.5 truncate text-sm font-medium">{linhaEndereco}</p>
          <div className="mt-0.5 flex flex-wrap gap-x-3 text-label text-muted-foreground">
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
    // CRÍTICO: passa lat/lon pra que useZapListings faça busca
    // geo-localizada (não fallback textual). Vem do autocomplete ou
    // do geocoding fallback em handleSubmit.
    latitude: f.latitude ?? null,
    longitude: f.longitude ?? null,
    // restante usa default do tipo (undefined / null)
  };
}

// ─── FieldLabel — visual de obrigatório vs opcional ───────────────────

/**
 * Label com indicação visual da obrigatoriedade do campo.
 *
 * Variantes:
 *  • `required-or-rua` / `required-or-bairro` — asterisco vermelho;
 *    sinaliza um dos dois (rua OU bairro) precisa estar preenchido.
 *  • `optional` — texto cinza "(opcional)" pequeno ao lado do label.
 *
 * O comportamento de validação "rua OU bairro" continua via
 * `hasMinimo` no submit; aqui só comunicamos visualmente.
 */
function FieldLabel({
  htmlFor,
  variant,
  children,
}: {
  htmlFor: string;
  variant: "required-or-rua" | "required-or-bairro" | "optional";
  children: React.ReactNode;
}) {
  return (
    <Label htmlFor={htmlFor} className="text-sm">
      {children}
      {variant === "required-or-rua" || variant === "required-or-bairro" ? (
        <span
          className="ml-0.5 text-destructive"
          aria-label="obrigatório (rua ou bairro)"
        >
          *
        </span>
      ) : (
        <span className="ml-1 text-meta font-normal text-muted-foreground">
          (opcional)
        </span>
      )}
    </Label>
  );
}
