// Signed URLs remain ephemeral and are fetched internally, never opened publicly.
export async function loadPrivateDocument(options: {
  download: () => Promise<{ data: Blob | null; error: unknown }>;
  createSignedUrl: () => Promise<{ data: { signedUrl: string } | null; error: unknown }>;
  fetchFile?: typeof fetch;
}): Promise<Blob> {
  const result = await options.download();
  if (!result.error && result.data) return result.data;
  const signed = await options.createSignedUrl();
  if (signed.error || !signed.data) throw signed.error || result.error || new Error('Documento indisponível.');
  const response = await (options.fetchFile ?? fetch)(signed.data.signedUrl, { cache: 'no-store', credentials: 'omit' });
  if (!response.ok) throw new Error('Não foi possível carregar o documento privado.');
  return response.blob();
}