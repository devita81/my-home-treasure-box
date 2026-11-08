// Shared, dependency-free contract for document extraction and form patching.
export const matriculaFields = {
  estado: { label: 'Estado', type: 'string', max: 2 },
  cidade: { label: 'Cidade', type: 'string', max: 100 },
  bairro: { label: 'Bairro', type: 'string', max: 100 },
  rua: { label: 'Rua', type: 'string', max: 200 },
  numero: { label: 'Número', type: 'string', max: 20 },
  apartamento: { label: 'Unidade (AP/CJ/LT)', type: 'string', max: 20 },
  complemento: { label: 'Complemento', type: 'string', max: 100 },
  cep: { label: 'CEP', type: 'string', max: 20 },
  numero_matricula: { label: 'Número da Matrícula', type: 'string', max: 50 },
  numero_contribuinte: { label: 'Número do Contribuinte', type: 'string', max: 50 },
  tipo_imovel: { label: 'Tipo de Imóvel', type: 'string', max: 30 },
  declared_value: { label: 'Valor Declarado', type: 'number', max: 100000000000 },
  proprietario_papel: { label: 'Proprietário (Papel)', type: 'string', max: 200 },
  proprietario_matricula: { label: 'Proprietário (Matrícula)', type: 'string', max: 200 },
  proprietario_matricula_ii: { label: 'Proprietário (Matrícula II)', type: 'string', max: 200 },
  percentual_proprietario_matricula: { label: '% Propriedade', type: 'number', max: 100 },
  percentual_proprietario_matricula_ii: { label: '% Propriedade II', type: 'number', max: 100 },
  metragem: { label: 'Área Útil (m²)', type: 'number', max: 100000 },
  area_comum: { label: 'Área Comum (m²)', type: 'number', max: 100000 },
  area_total: { label: 'Área Total (m²)', type: 'number', max: 200000 },
  quartos: { label: 'Quartos', type: 'number', max: 50 },
  banheiros: { label: 'Banheiros', type: 'number', max: 50 },
  suites: { label: 'Suítes', type: 'number', max: 50 },
  garagens: { label: 'Garagens', type: 'number', max: 50 },
  ano_construcao: { label: 'Ano de Construção', type: 'number', max: 2100 },
} as const;

export type MatriculaField = keyof typeof matriculaFields;
export interface ExtractedField {
  field: MatriculaField;
  value: string | number;
  evidence: string;
  page: number | null;
}
export interface MatriculaExtraction {
  fields: ExtractedField[];
  warnings: string[];
  sale_reference: string;
}
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function validateExtraction(input: unknown): MatriculaExtraction {
  if (!isRecord(input) || !Array.isArray(input.fields) || input.fields.length > 25 ||
      !Array.isArray(input.warnings) || input.warnings.length > 30 ||
      typeof input.sale_reference !== 'string' || input.sale_reference.length > 1000) {
    throw new Error('Resposta documental inválida.');
  }
  const fields: ExtractedField[] = [];
  const seen = new Set<string>();
  for (const entry of input.fields) {
    if (!isRecord(entry) || typeof entry.field !== 'string' ||
        !Object.prototype.hasOwnProperty.call(matriculaFields, entry.field) || seen.has(entry.field)) {
      throw new Error('Campo documental inválido.');
    }
    seen.add(entry.field);
    if (entry.value === null) continue;
    const field = entry.field as MatriculaField;
    const rule = matriculaFields[field];
    if (typeof entry.evidence !== 'string' || !entry.evidence.trim() || entry.evidence.length > 1200 ||
        (entry.page !== null && (typeof entry.page !== 'number' || !Number.isInteger(entry.page) || entry.page < 1 || entry.page > 40))) {
      throw new Error('Referência documental inválida.');
    }
    if (rule.type === 'number') {
      if (typeof entry.value !== 'number' || !Number.isFinite(entry.value) || entry.value < 0 || entry.value > rule.max) throw new Error('Valor documental inválido.');
      if (field === 'ano_construcao' && (entry.value < 1800 || entry.value > new Date().getFullYear())) throw new Error('Ano inválido.');
    } else if (typeof entry.value !== 'string' || !entry.value.trim() || entry.value.length > rule.max) {
      throw new Error('Texto documental inválido.');
    }
    if (field === 'estado' && !/^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/.test(String(entry.value))) throw new Error('Estado inválido.');
    if (field === 'tipo_imovel' && !['apartamento', 'casa', 'terreno', 'conjunto_comercial', 'garagem'].includes(String(entry.value))) throw new Error('Tipo inválido.');
    fields.push({ field, value: typeof entry.value === 'string' ? entry.value.trim() : entry.value, evidence: entry.evidence.trim(), page: entry.page as number | null });
  }
  const warnings = input.warnings.map(value => {
    if (typeof value !== 'string' || value.length > 1500) throw new Error('Alerta inválido.');
    return value;
  });
  return { fields, warnings, sale_reference: input.sale_reference };
}

export function selectedMatriculaPatch(extraction: MatriculaExtraction, selected: ReadonlySet<MatriculaField>) {
  const patch: Partial<Record<MatriculaField, string | number>> = {};
  for (const entry of validateExtraction(extraction).fields) {
    if (selected.has(entry.field)) patch[entry.field] = entry.value;
  }
  return patch;
}

export const matriculaOutputSchema = {
  type: 'object', additionalProperties: false,
  required: ['fields', 'warnings', 'sale_reference'],
  properties: {
    fields: { type: 'array', items: {
      type: 'object', additionalProperties: false, required: ['field', 'value', 'evidence', 'page'],
      properties: {
        field: { type: 'string', enum: Object.keys(matriculaFields) },
        value: { type: ['string', 'number', 'null'] },
        evidence: { type: 'string' }, page: { type: ['integer', 'null'] },
      },
    } },
    warnings: { type: 'array', items: { type: 'string' } },
    sale_reference: { type: 'string' },
  },
};