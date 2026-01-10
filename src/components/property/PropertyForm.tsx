import { useState } from 'react';
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
import { Save, ArrowLeft, MapPin, DollarSign, FileText, User } from 'lucide-react';

const estados = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

interface PropertyFormProps {
  property?: Property;
  mode: 'add' | 'edit';
}

export function PropertyForm({ property, mode }: PropertyFormProps) {
  const navigate = useNavigate();
  const { addProperty, updateProperty } = useProperties();

  const [formData, setFormData] = useState<PropertyFormData>({
    estado: property?.estado || 'SP',
    cidade: property?.cidade || '',
    bairro: property?.bairro || '',
    rua: property?.rua || '',
    numero: property?.numero || '',
    apartamento: property?.apartamento || '',
    declared_value: property?.declared_value || 0,
    numero_matricula: property?.numero_matricula || '',
    market_value: property?.market_value || 0,
    iptu_value: property?.iptu_value || 0,
    photos: property?.photos || [],
    iptu_pago: property?.iptu_pago || false,
    proprietario_papel: property?.proprietario_papel || '',
    proprietario_matricula: property?.proprietario_matricula || '',
    validado: property?.validado || false,
    vendido: property?.vendido || false,
    alugado: property?.alugado || false,
    inquilino: property?.inquilino || '',
    valor_aluguel: property?.valor_aluguel || 0,
    valor_condominio: property?.valor_condominio || 0,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.cidade || !formData.rua || !formData.numero) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    if (mode === 'add') {
      addProperty(formData);
      toast.success('Imóvel adicionado com sucesso!');
    } else if (property) {
      updateProperty(property.id, formData);
      toast.success('Imóvel atualizado com sucesso!');
    }
    
    navigate('/');
  };

  const handleChange = (field: keyof PropertyFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between">
        <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <Button type="submit">
          <Save className="h-4 w-4 mr-2" />
          {mode === 'add' ? 'Adicionar Imóvel' : 'Salvar Alterações'}
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
            <div className="grid grid-cols-2 gap-4">
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
                  placeholder="São Paulo"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bairro">Bairro</Label>
              <Input
                id="bairro"
                value={formData.bairro}
                onChange={(e) => handleChange('bairro', e.target.value)}
                placeholder="Jardins"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rua">Rua *</Label>
              <Input
                id="rua"
                value={formData.rua}
                onChange={(e) => handleChange('rua', e.target.value)}
                placeholder="Rua Oscar Freire"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="numero">Número *</Label>
                <Input
                  id="numero"
                  value={formData.numero}
                  onChange={(e) => handleChange('numero', e.target.value)}
                  placeholder="1500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apartamento">Apartamento</Label>
                <Input
                  id="apartamento"
                  value={formData.apartamento}
                  onChange={(e) => handleChange('apartamento', e.target.value)}
                  placeholder="121"
                />
              </div>
            </div>
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="declared_value">Valor Declarado</Label>
                <Input
                  id="declared_value"
                  type="number"
                  value={formData.declared_value}
                  onChange={(e) => handleChange('declared_value', Number(e.target.value))}
                  placeholder="1500000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="market_value">Valor de Mercado</Label>
                <Input
                  id="market_value"
                  type="number"
                  value={formData.market_value}
                  onChange={(e) => handleChange('market_value', Number(e.target.value))}
                  placeholder="1800000"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="iptu_value">Valor IPTU (anual)</Label>
              <Input
                id="iptu_value"
                type="number"
                value={formData.iptu_value}
                onChange={(e) => handleChange('iptu_value', Number(e.target.value))}
                placeholder="8500"
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="valor_aluguel">Valor Aluguel</Label>
                <Input
                  id="valor_aluguel"
                  type="number"
                  value={formData.valor_aluguel}
                  onChange={(e) => handleChange('valor_aluguel', Number(e.target.value))}
                  placeholder="8500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="valor_condominio">Valor Condomínio</Label>
                <Input
                  id="valor_condominio"
                  type="number"
                  value={formData.valor_condominio}
                  onChange={(e) => handleChange('valor_condominio', Number(e.target.value))}
                  placeholder="1200"
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
            <div className="space-y-2">
              <Label htmlFor="numero_matricula">Número da Matrícula</Label>
              <Input
                id="numero_matricula"
                value={formData.numero_matricula}
                onChange={(e) => handleChange('numero_matricula', e.target.value)}
                placeholder="MAT-2024-001"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="proprietario_papel">Proprietário (Papel)</Label>
              <Input
                id="proprietario_papel"
                value={formData.proprietario_papel}
                onChange={(e) => handleChange('proprietario_papel', e.target.value)}
                placeholder="Escritura Pública"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="proprietario_matricula">Proprietário (Matrícula)</Label>
              <Input
                id="proprietario_matricula"
                value={formData.proprietario_matricula}
                onChange={(e) => handleChange('proprietario_matricula', e.target.value)}
                placeholder="João Silva"
              />
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
                  placeholder="Maria Santos"
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
