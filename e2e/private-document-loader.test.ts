import { expect, test } from 'bun:test';
import { loadPrivateDocument } from '../src/lib/private-document-loader';

test('download privado normal não solicita URL temporária', async () => {
  const blob = new Blob(['%PDF-1.7']);
  let signedRequests = 0;
  const result = await loadPrivateDocument({ download: async () => ({ data: blob, error: null }), createSignedUrl: async () => { signedRequests++; return { data: null, error: new Error('unexpected') }; } });
  expect(result).toBe(blob);
  expect(signedRequests).toBe(0);
});

test('falha de download usa URL autorizada apenas para leitura interna', async () => {
  let requested = '';
  const result = await loadPrivateDocument({ download: async () => ({ data: null, error: new Error('StorageUnknownError') }), createSignedUrl: async () => ({ data: { signedUrl: 'https://example.test/private-signed' }, error: null }), fetchFile: (async (url, init) => { requested = String(url); expect(init?.credentials).toBe('omit'); return new Response('%PDF-1.7'); }) as typeof fetch });
  expect(requested).toBe('https://example.test/private-signed');
  expect(await result.text()).toBe('%PDF-1.7');
});

test('acesso negado não tenta obter o arquivo sem autorização', async () => {
  let fetched = false;
  await expect(loadPrivateDocument({ download: async () => ({ data: null, error: new Error('denied') }), createSignedUrl: async () => ({ data: null, error: new Error('denied') }), fetchFile: (async () => { fetched = true; return new Response('secret'); }) as typeof fetch })).rejects.toThrow('denied');
  expect(fetched).toBe(false);
});