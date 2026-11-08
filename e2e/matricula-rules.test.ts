import { describe, expect, test } from 'bun:test';
import { selectedMatriculaPatch, validateExtraction, type MatriculaExtraction } from '../supabase/functions/_shared/matricula-contract';

const example: MatriculaExtraction = {
  fields: [
    { field: 'declared_value', value: 650000, evidence: 'R.5: pelo preço de R$ 650.000,00', page: 7 },
    { field: 'area_total', value: 1022.27, evidence: 'encerrando a área de 1.022,27 metros quadrados', page: 5 },
    { field: 'numero_matricula', value: '35.821', evidence: 'matrícula 35.821', page: 5 },
  ], warnings: [], sale_reference: 'R.5/35.821 — 13/07/2026',
};
describe('Cadastro pela matrícula', () => {
  test('valor declarado conserva o preço de venda, não o valor venal', () => {
    expect(selectedMatriculaPatch(example, new Set(['declared_value'])).declared_value).toBe(650000);
  });
  test('área de lote é área total e não área útil construída', () => {
    const patch = selectedMatriculaPatch(example, new Set(['area_total', 'metragem']));
    expect(patch.area_total).toBe(1022.27);
    expect(patch).not.toHaveProperty('metragem');
  });
  test('campos desmarcados ou ausentes preservam valores humanos existentes', () => {
    const previous = { declared_value: 123, numero_matricula: 'manual', rua: 'Rua editada', valor_aluguel: 2500 };
    const next = { ...previous, ...selectedMatriculaPatch(example, new Set(['declared_value'])) };
    expect(next).toEqual({ declared_value: 650000, numero_matricula: 'manual', rua: 'Rua editada', valor_aluguel: 2500 });
  });
  test('extrator não aceita aluguel ou status de ocupação como campos cadastrais', () => {
    for (const field of ['valor_aluguel', 'vendido', 'validado', 'market_value']) {
      expect(() => validateExtraction({ ...example, fields: [{ field, value: 100, evidence: 'texto', page: 1 }] })).toThrow();
    }
  });
  test('informações ausentes são omitidas e não viram valores fabricados', () => {
    expect(validateExtraction({ ...example, fields: [{ field: 'rua', value: null, evidence: '', page: null }] }).fields).toEqual([]);
  });
});