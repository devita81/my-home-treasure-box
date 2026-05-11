import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Property, PropertyFormData } from '@/types/property';
import { useProperties } from '@/contexts/PropertyContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { Save, ArrowLeft, MapPin, DollarSign, FileText, User, Home, MessageSquare, Maximize2, Minimize2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { z } from 'zod';
import { CurrencyInput } from '@/components/ui/currency-input';

import { DocumentUpload } from './DocumentUpload';
import { PropertyMediaUpload } from './PropertyMediaUpload';
import { MapPinPicker } from './MapPinPicker';
import { AddressAutocompleteInput } from '@/components/ui/address-autocomplete-input';

// Validation schema for property form
const propertySchema = z.object({
  estado: z.string().min(2).max(2),
  cidade: z.string().trim().min(2, 'Cidade deve ter pelo menos 2 caracteres').max(100, 'Cidade muito longa'),
  bairro: z.string().trim().max(100, 'Bairro muito longo').optional().or(z.literal('')),
  rua: z.string().trim().min(2, 'Rua é obrigatória (pelo menos 2 caracteres)').max(200, 'Rua muito longa'),
  // Número é obrigatório porque sem ele o endereço não geocodifica
  // direito e a Estimativa IA / ITBI ficam imprecisos. Se for imóvel
  // realmente sem número, usuário pode digitar "S/N" ou similar.
  numero: z.string().trim().min(1, 'Número é obrigatório (use "S/N" se o imóvel não tiver número)').max(20, 'Número muito longo'),
  apartamento: z.string().trim().max(20, 'Apartamento muito longo').optional().or(z.literal('')).nullable(),
  complemento: z.string().trim().max(100, 'Complemento muito longo').optional().or(z.literal('')).nullable(),
  declared_value: z.number().min(0, 'Valor não pode ser negativo').max(100000000000, 'Valor muito alto'),
  numero_matricula: z.string().trim().max(50, 'Matrícula muito longa').optional().or(z.literal('')),
  market_value: z.number().min(0, 'Valor não pode ser negativo').max(100000000000, 'Valor muito alto'),
  iptu_value: z.number().min(0, 'Valor não pode ser negativo').max(10000000, 'Valor muito alto'),
  photos: z.array(z.string().url().or(z.literal(''))).optional(),
  iptu_pago: z.boolean(),
  proprietario_papel: z.string().trim().max(200, 'Nome muito longo').optional().or(z.literal('')),
  proprietario_matricula: z.string().trim().max(200, 'Nome muito longo').optional().or(z.literal('')),
  proprietario_matricula_ii: z.string().trim().max(200, 'Nome muito longo').optional().or(z.literal('')).nullable(),
  percentual_proprietario_matricula: z.number().min(0).max(100).nullable().optional(),
  percentual_proprietario_matricula_ii: z.number().min(0).max(100).nullable().optional(),
  validado: z.boolean(),
  vendido: z.boolean(),
  alugado: z.boolean(),
  inquilino: z.string().trim().max(200, 'Nome muito longo').optional().or(z.literal('')),
  valor_aluguel: z.number().min(0, 'Valor não pode ser negativo').max(10000000, 'Valor muito alto'),
  valor_condominio: z.number().min(0, 'Valor não pode ser negativo').max(1000000, 'Valor muito alto'),
  quartos: z.number().min(0).max(50),
  banheiros: z.number().min(0).max(50),
  suites: z.number().min(0).max(50),
  garagens: z.number().min(0).max(50),
  metragem: z.number().min(0).max(100000),
  area_comum: z.number().min(0).max(100000),
  area_total: z.number().min(0).max(200000),
  numero_contribuinte: z.string().trim().max(50, 'Número do contribuinte muito longo').optional().or(z.literal('')),
  tipo_imovel: z.string().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  ano_construcao: z.number().min(1800).max(new Date().getFullYear()).nullable().optional(),
  observacao: z.string().nullable().optional(),
  taxa_administracao: z.number().min(0, 'Valor não pode ser negativo').max(1000000, 'Valor muito alto').nullable().optional(),
  // CEP é preenchido pelo autocomplete (Nominatim) quando disponível.
  // Aceita só dígitos OU vazio. Validação leve — formato pode variar
  // (Nominatim devolve "01234-567", normalizamos pra "01234567").
  cep: z.string().trim().max(20).optional().nullable().or(z.literal('')),
});

const estados = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

interface PropertyFormProps {
  property?: Property;
  mode: 'add' | 'edit';
}

export function PropertyForm({ property, mode }: PropertyFormProps) {
  const navigate = useNavigate();
  const { addProperty, updateProperty } = useProperties();

  const initialFromProp = useMemo<PropertyFormData>(
    () => ({
      estado: property?.estado || 'SP',
      cidade: property?.cidade || '',
      bairro: property?.bairro || '',
      rua: property?.rua || '',
      numero: property?.numero || '',
      apartamento: property?.apartamento || '',
      complemento: property?.complemento || '',
      declared_value: property?.declared_value || 0,
      numero_matricula: property?.numero_matricula || '',
      market_value: property?.market_value || 0,
      iptu_value: property?.iptu_value || 0,
      photos: property?.photos || [],
      iptu_pago: property?.iptu_pago || false,
      proprietario_papel: property?.proprietario_papel || '',
      proprietario_matricula: property?.proprietario_matricula || '',
      proprietario_matricula_ii: property?.proprietario_matricula_ii || '',
      percentual_proprietario_matricula: property?.percentual_proprietario_matricula ?? 100,
      percentual_proprietario_matricula_ii: property?.percentual_proprietario_matricula_ii ?? 0,
      validado: property?.validado || false,
      vendido: property?.vendido || false,
      alugado: property?.alugado || false,
      inquilino: property?.inquilino || '',
      valor_aluguel: property?.valor_aluguel || 0,
      valor_condominio: property?.valor_condominio || 0,
      quartos: property?.quartos || 0,
      banheiros: property?.banheiros || 0,
      suites: property?.suites || 0,
      garagens: property?.garagens || 0,
      metragem: property?.metragem || 0,
      area_comum: property?.area_comum || 0,
      area_total: property?.area_total || 0,
      numero_contribuinte: property?.numero_contribuinte || '',
      tipo_imovel: property?.tipo_imovel || 'apartamento',
      latitude: property?.latitude || null,
      longitude: property?.longitude || null,
      ano_construcao: property?.ano_construcao || null,
      observacao: property?.observacao || '',
      taxa_administracao: property?.taxa_administracao ?? null,
      cep: property?.cep || '',
    }),
    [property]
  );

  const draftKey = useMemo(() => {
    if (mode === 'edit' && property?.id) return `property_draft:${property.id}`;
    return 'property_draft:add';
  }, [mode, property?.id]);

  const [formData, setFormData] = useState<PropertyFormData>(initialFromProp);
  const [isObservacaoExpanded, setIsObservacaoExpanded] = useState(false);
  const saveTimeoutRef = useRef<number | null>(null);

  // Restaura rascunho ao montar/recarregar a página (evita perder dados ao alt+tab, refresh, etc.)
  useEffect(() => {
    setFormData(initialFromProp);

    if (mode !== 'edit' || !property?.id) return;

    const raw = sessionStorage.getItem(draftKey);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as Partial<PropertyFormData>;
      setFormData((prev) => ({ ...prev, ...parsed }));
    } catch {
      // ignore
    }
  }, [draftKey, initialFromProp, mode, property?.id]);

  // Auto-salva o rascunho no sessionStorage
  useEffect(() => {
    if (mode !== 'edit' || !property?.id) return;

    if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = window.setTimeout(() => {
      try {
        sessionStorage.setItem(draftKey, JSON.stringify(formData));
      } catch {
        // ignore
      }
    }, 250);

    return () => {
      if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
    };
  }, [draftKey, formData, mode, property?.id]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Guard against double-submit if user mashes the button.
    if (isSubmitting) return;

    // Validate form data using zod schema
    const result = propertySchema.safeParse(formData);

    if (!result.success) {
      const firstError = result.error.errors[0];
      toast.error(firstError.message || 'Dados inválidos');
      return;
    }

    // Use validated data
    const validatedData = result.data;

    setIsSubmitting(true);
    try {
      if (mode === 'add') {
        await addProperty(validatedData as PropertyFormData);
        toast.success('Imóvel adicionado com sucesso!');
      } else if (property) {
        await updateProperty(property.id, validatedData as PropertyFormData);
        toast.success('Imóvel atualizado com sucesso!');
        sessionStorage.removeItem(draftKey);
      }

      navigate('/');
    } catch (error: unknown) {
      logger.error('Error saving property:', error);
      toast.error('Erro ao salvar. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = <K extends keyof PropertyFormData>(
    field: K,
    value: PropertyFormData[K],
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="min-w-0 space-y-6 overflow-x-hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {isSubmitting
            ? 'Salvando...'
            : mode === 'add'
              ? 'Adicionar Imóvel'
              : 'Salvar Alterações'}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Localização */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MapPin className="h-5 w-5 text-primary" />
              Localização
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="estado">Estado *</Label>
                <Select
                  value={formData.estado}
                  onValueChange={(value) => handleChange('estado', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {estados.map((uf) => (
                      <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cidade">Cidade *</Label>
                <Input
                  id="cidade"
                  value={formData.cidade}
                  onChange={(e) => handleChange('cidade', e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bairro">Bairro</Label>
              <Input
                id="bairro"
                value={formData.bairro}
                onChange={(e) => handleChange('bairro', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rua">
                Rua <span className="text-destructive" aria-label="obrigatório">*</span>
              </Label>
              <AddressAutocompleteInput
                id="rua"
                value={formData.rua}
                onChange={(v) => handleChange('rua', v)}
                onSelect={(s) => {
                  // Auto-preenche bairro/cidade/estado/cep/lat/lon a partir
                  // da sugestão do Nominatim. Só sobrescreve campo destino
                  // se a sugestão tiver valor — caso contrário preserva o
                  // que o user já tinha digitado.
                  setFormData((prev) => ({
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
                contextCidade={formData.cidade}
                contextEstado={formData.estado}
                required
                aria-required="true"
                placeholder="Ex: Rua Pio XI (autocomplete via mapa)"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="numero">
                  Número <span className="text-destructive" aria-label="obrigatório">*</span>
                </Label>
                <Input
                  id="numero"
                  value={formData.numero || ''}
                  onChange={(e) => handleChange('numero', e.target.value)}
                  required
                  aria-required="true"
                  placeholder='Use "S/N" se não tiver número'
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apartamento">Unidade (AP/CJ/LT)</Label>
                <Input
                  id="apartamento"
                  value={formData.apartamento || ''}
                  onChange={(e) => handleChange('apartamento', e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="complemento">Complemento</Label>
                <Input
                  id="complemento"
                  value={formData.complemento || ''}
                  onChange={(e) => handleChange('complemento', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tipo_imovel">Tipo de Imóvel</Label>
                <Select
                  value={formData.tipo_imovel || 'apartamento'}
                  onValueChange={(value) => handleChange('tipo_imovel', value)}
                >
                  <SelectTrigger id="tipo_imovel">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="apartamento">Apartamento</SelectItem>
                    <SelectItem value="casa">Casa</SelectItem>
                    <SelectItem value="terreno">Terreno</SelectItem>
                    <SelectItem value="conjunto_comercial">Conjunto Comercial</SelectItem>
                    <SelectItem value="garagem">Garagem</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <MapPinPicker
              latitude={formData.latitude ?? null}
              longitude={formData.longitude ?? null}
              onCoordsChange={(lat, lng) => {
                handleChange('latitude', lat);
                handleChange('longitude', lng);
              }}
              address={[formData.rua, formData.numero, formData.bairro, formData.cidade, formData.estado].filter(Boolean).join(', ')}
            />

          </CardContent>
        </Card>

        {/* Valores */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <DollarSign className="h-5 w-5 text-primary" />
              Valores
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="declared_value">Valor Declarado</Label>
                <CurrencyInput
                  id="declared_value"
                  value={formData.declared_value}
                  onChange={(v) => handleChange('declared_value', v ?? 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="market_value">Valor de Mercado</Label>
                <CurrencyInput
                  id="market_value"
                  value={formData.market_value}
                  onChange={(v) => handleChange('market_value', v ?? 0)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="iptu_value">Valor IPTU (mensal)</Label>
              <CurrencyInput
                id="iptu_value"
                value={formData.iptu_value}
                onChange={(v) => handleChange('iptu_value', v ?? 0)}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
              <Label htmlFor="iptu_pago" className="cursor-pointer">IPTU Pago</Label>
              <Switch
                id="iptu_pago"
                checked={formData.iptu_pago}
                onCheckedChange={(checked) => handleChange('iptu_pago', checked)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="valor_aluguel">Valor Aluguel</Label>
                <CurrencyInput
                  id="valor_aluguel"
                  value={formData.valor_aluguel ?? null}
                  onChange={(v) => handleChange('valor_aluguel', v ?? 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="valor_condominio">Valor Condomínio</Label>
                <CurrencyInput
                  id="valor_condominio"
                  value={formData.valor_condominio ?? null}
                  onChange={(v) => handleChange('valor_condominio', v ?? 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxa_administracao">Taxa de Administração</Label>
                <CurrencyInput
                  id="taxa_administracao"
                  value={formData.taxa_administracao ?? null}
                  onChange={(v) => handleChange('taxa_administracao', v)}
                  allowNull
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Documentação */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5 text-primary" />
              Documentação
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="numero_matricula">Número da Matrícula</Label>
                <Input
                  id="numero_matricula"
                  value={formData.numero_matricula}
                  onChange={(e) => handleChange('numero_matricula', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="numero_contribuinte">Número do Contribuinte</Label>
                <Input
                  id="numero_contribuinte"
                  value={formData.numero_contribuinte}
                  onChange={(e) => handleChange('numero_contribuinte', e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="proprietario_papel">Proprietário (Papel)</Label>
              <Input
                id="proprietario_papel"
                value={formData.proprietario_papel}
                onChange={(e) => handleChange('proprietario_papel', e.target.value)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="proprietario_matricula">Proprietário (Matrícula)</Label>
                <Input
                  id="proprietario_matricula"
                  value={formData.proprietario_matricula}
                  onChange={(e) => handleChange('proprietario_matricula', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="percentual_proprietario_matricula">% Propriedade</Label>
                <Input
                  id="percentual_proprietario_matricula"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.percentual_proprietario_matricula ?? 100}
                  onChange={(e) => handleChange('percentual_proprietario_matricula', e.target.value === '' ? 100 : Number(e.target.value))}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="proprietario_matricula_ii">Proprietário (Matrícula II)</Label>
                <Input
                  id="proprietario_matricula_ii"
                  value={formData.proprietario_matricula_ii || ''}
                  onChange={(e) => handleChange('proprietario_matricula_ii', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="percentual_proprietario_matricula_ii">% Propriedade</Label>
                <Input
                  id="percentual_proprietario_matricula_ii"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.percentual_proprietario_matricula_ii ?? 0}
                  onChange={(e) => handleChange('percentual_proprietario_matricula_ii', e.target.value === '' ? 0 : Number(e.target.value))}
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
              <Label htmlFor="validado" className="cursor-pointer">Imóvel Validado</Label>
              <Switch
                id="validado"
                checked={formData.validado}
                onCheckedChange={(checked) => handleChange('validado', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Document Upload - Only show in edit mode */}
        {mode === 'edit' && property?.id && (
          <DocumentUpload propertyId={property.id} mode="edit" />
        )}

        {/* Media Upload - Only show in edit mode */}
        {mode === 'edit' && property?.id && (
          <PropertyMediaUpload
            propertyId={property.id}
            photos={formData.photos || []}
            onPhotosChange={(photos) => handleChange('photos', photos)}
          />
        )}

        {/* Características */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Home className="h-5 w-5 text-primary" />
              Características
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="quartos">Quartos</Label>
                <Input
                  id="quartos"
                  type="number"
                  min="0"
                  value={formData.quartos || ''}
                  onChange={(e) => handleChange('quartos', e.target.value === '' ? 0 : Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="banheiros">Banheiros</Label>
                <Input
                  id="banheiros"
                  type="number"
                  min="0"
                  value={formData.banheiros || ''}
                  onChange={(e) => handleChange('banheiros', e.target.value === '' ? 0 : Number(e.target.value))}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="suites">Suítes</Label>
                <Input
                  id="suites"
                  type="number"
                  min="0"
                  value={formData.suites || ''}
                  onChange={(e) => handleChange('suites', e.target.value === '' ? 0 : Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="garagens">Garagens</Label>
                <Input
                  id="garagens"
                  type="number"
                  min="0"
                  value={formData.garagens || ''}
                  onChange={(e) => handleChange('garagens', e.target.value === '' ? 0 : Number(e.target.value))}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="metragem">Área Útil (m²)</Label>
                <Input
                  id="metragem"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.metragem || ''}
                  onChange={(e) => {
                    const metragem = e.target.value === '' ? 0 : Number(e.target.value);
                    handleChange('metragem', metragem);
                    handleChange('area_total', metragem + (formData.area_comum || 0));
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="area_comum">Área Comum (m²)</Label>
                <Input
                  id="area_comum"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.area_comum || ''}
                  onChange={(e) => {
                    const areaComum = e.target.value === '' ? 0 : Number(e.target.value);
                    handleChange('area_comum', areaComum);
                    handleChange('area_total', (formData.metragem || 0) + areaComum);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="area_total">Área Total (m²)</Label>
                <Input
                  id="area_total"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.area_total || ''}
                  onChange={(e) => handleChange('area_total', e.target.value === '' ? 0 : Number(e.target.value))}
                  className="bg-muted"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ano_construcao">Ano de Construção</Label>
              <Input
                id="ano_construcao"
                type="number"
                min="1800"
                max={new Date().getFullYear()}
                placeholder="Ex: 1995"
                value={formData.ano_construcao || ''}
                onChange={(e) => handleChange('ano_construcao', e.target.value === '' ? null : Number(e.target.value))}
              />
            </div>
          </CardContent>
        </Card>

        {/* Status e Inquilino */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5 text-primary" />
              Status e Ocupação
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
              <Label htmlFor="vendido" className="cursor-pointer">Vendido</Label>
              <Switch
                id="vendido"
                checked={formData.vendido}
                onCheckedChange={(checked) => {
                  handleChange('vendido', checked);
                  if (checked) handleChange('alugado', false);
                }}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
              <Label htmlFor="alugado" className="cursor-pointer">Alugado</Label>
              <Switch
                id="alugado"
                checked={formData.alugado}
                onCheckedChange={(checked) => {
                  handleChange('alugado', checked);
                  if (checked) handleChange('vendido', false);
                }}
              />
            </div>

            {formData.alugado && (
              <div className="space-y-2 animate-fade-in">
                <Label htmlFor="inquilino">Nome do Inquilino</Label>
                <Input
                  id="inquilino"
                  value={formData.inquilino}
                  onChange={(e) => handleChange('inquilino', e.target.value)}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Observações */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageSquare className="h-5 w-5 text-primary" />
              Observações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Label htmlFor="observacao">Notas e observações sobre o imóvel</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsObservacaoExpanded(!isObservacaoExpanded)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {isObservacaoExpanded ? (
                    <>
                      <Minimize2 className="h-4 w-4 mr-1" />
                      Recolher
                    </>
                  ) : (
                    <>
                      <Maximize2 className="h-4 w-4 mr-1" />
                      Expandir
                    </>
                  )}
                </Button>
              </div>
              <Textarea
                id="observacao"
                placeholder="Adicione observações, lembretes ou notas importantes sobre este imóvel..."
                value={formData.observacao || ''}
                onChange={(e) => handleChange('observacao', e.target.value)}
                className={cn(
                  "resize-y transition-all duration-300 font-mono text-sm leading-relaxed whitespace-pre-wrap",
                  isObservacaoExpanded ? "min-h-[400px]" : "min-h-[120px]"
                )}
              />
              <p className="text-sm text-muted-foreground text-right">
                {(formData.observacao || '').length.toLocaleString('pt-BR')} caracteres
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
