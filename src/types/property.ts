export interface Property {
  id: string;
  estado: string;
  cidade: string;
  bairro: string;
  rua: string;
  numero: string | null;
  apartamento?: string | null;
  complemento?: string | null;
  declared_value: number;
  numero_matricula: string;
  market_value: number;
  iptu_value: number;
  photos: string[];
  created_at: string;
  updated_at: string;
  iptu_pago: boolean;
  proprietario_papel: string;
  proprietario_matricula: string;
  user_id: string;
  validado: boolean;
  vendido: boolean;
  alugado: boolean;
  inquilino?: string;
  valor_aluguel?: number;
  valor_condominio?: number;
  quartos?: number;
  banheiros?: number;
  suites?: number;
  garagens?: number;
  metragem?: number;
  area_comum?: number;
  area_total?: number;
  numero_contribuinte?: string;
  tipo_imovel?: string;
  latitude?: number | null;
  longitude?: number | null;
  ano_construcao?: number | null;
}

export type PropertyFormData = Omit<Property, 'id' | 'created_at' | 'updated_at' | 'user_id'>;

export type SortField = 'updated_at' | 'area_total' | 'declared_value' | 'market_value' | 'iptu_value' | 'rua' | 'valor_aluguel' | 'valor_condominio' | 'cidade';
export type SortOrder = 'asc' | 'desc';

export interface PropertyFilters {
  search: string;
  estado: string;
  cidade: string;
  bairro: string;
  tipoImovel: string;
  proprietarioPapel: string;
  proprietarioMatricula: string;
  status: 'all' | 'vendido' | 'alugado' | 'disponivel';
  validado: 'all' | 'sim' | 'nao';
  sortField: SortField;
  sortOrder: SortOrder;
}
