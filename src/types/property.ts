export interface Property {
  id: string;
  estado: string;
  cidade: string;
  bairro: string;
  rua: string;
  numero: string;
  apartamento?: string;
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
}

export type PropertyFormData = Omit<Property, 'id' | 'created_at' | 'updated_at' | 'user_id'>;

export interface PropertyFilters {
  search: string;
  estado: string;
  cidade: string;
  status: 'all' | 'vendido' | 'alugado' | 'disponivel';
  validado: 'all' | 'sim' | 'nao';
}
