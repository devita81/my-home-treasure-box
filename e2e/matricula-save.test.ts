import { expect, test } from 'bun:test';
import { saveWithDocuments } from '../src/lib/property-save-with-documents';

test('anexa matrícula apenas depois do cadastro explicitamente salvo', async () => {
  const calls: string[] = [];
  await saveWithDocuments({ existingId: null, values: {}, create: async () => { calls.push('create'); return 'property-id'; }, update: async () => {}, rememberId: id => calls.push(`remember:${id}`), attach: async id => { calls.push(`attach:${id}`); } });
  expect(calls).toEqual(['create', 'remember:property-id', 'attach:property-id']);
});
test('falha no anexo não duplica o imóvel na tentativa seguinte', async () => {
  let id: string | null = null; let created = 0; let attempts = 0;
  const options = { values: {}, create: async () => { created++; return 'saved-id'; }, update: async () => {}, rememberId: (value: string) => { id = value; }, attach: async () => { if (++attempts === 1) throw new Error('upload failed'); } };
  await expect(saveWithDocuments({ ...options, existingId: id })).rejects.toThrow();
  expect(id).toBe('saved-id');
  await saveWithDocuments({ ...options, existingId: id });
  expect(created).toBe(1);
  expect(attempts).toBe(2);
});