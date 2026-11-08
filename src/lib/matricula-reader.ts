import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = workerUrl;
export const MAX_DOCUMENT_BYTES = 12 * 1024 * 1024;
export const MAX_DOCUMENT_PAGES = 40;
export function validateMatriculaFiles(files: readonly Pick<File, 'size' | 'type'>[]) {
  if (!files.length || files.length > MAX_DOCUMENT_PAGES) throw new Error('Selecione um PDF ou até 40 fotos.');
  if (files.some(file => !['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type))) throw new Error('Use PDF, JPG, PNG ou WebP.');
  if (files.reduce((sum, file) => sum + file.size, 0) > MAX_DOCUMENT_BYTES) throw new Error('Os arquivos devem somar no máximo 12 MB.');
}
async function imageData(file: File) {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Não foi possível preparar a imagem.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally { bitmap.close(); }
}
export async function readMatriculaFiles(files: readonly File[], onProgress: (label: string) => void) {
  validateMatriculaFiles(files);
  const text: string[] = []; const images: string[] = [];
  let pages = 0;
  for (const file of files) {
    if (file.type !== 'application/pdf') {
      if (++pages > MAX_DOCUMENT_PAGES) throw new Error('Limite de 40 páginas por leitura.');
      onProgress(`Preparando página ${pages}…`);
      images.push(await imageData(file));
      text.push(`[Página ${pages}: imagem ${images.length}]`);
      continue;
    }
    const loading = getDocument({ data: await file.arrayBuffer() });
    try {
      const pdf = await loading.promise;
      if (pages + pdf.numPages > MAX_DOCUMENT_PAGES) throw new Error('Limite de 40 páginas por leitura. Divida o PDF.');
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p); pages++;
        onProgress(`Lendo página ${pages}…`);
        const content = await page.getTextContent();
        const pageText = content.items.map(item => 'str' in item ? `${item.str}${item.hasEOL ? '\n' : ' '}` : '').join('');
        text.push(`[Página ${pages}]\n${pageText}`);
        // Rasterize sparse/scanned pages for vision OCR; never silently omit them.
        if (pageText.replace(/\s/g, '').length < 200 || content.items.some(item => 'str' in item && item.str.includes('�'))) {
          const viewport = page.getViewport({ scale: 1 });
          const scaled = page.getViewport({ scale: 1800 / Math.max(viewport.width, viewport.height) });
          const canvas = document.createElement('canvas');
          canvas.width = Math.ceil(scaled.width); canvas.height = Math.ceil(scaled.height);
          const context = canvas.getContext('2d');
          if (!context) throw new Error('Não foi possível preparar o PDF.');
          await page.render({ canvasContext: context, canvas, viewport: scaled }).promise;
          images.push(canvas.toDataURL('image/jpeg', 0.85));
          text.push(`[Imagem ${images.length} corresponde à página ${pages}]`);
        }
        page.cleanup();
      }
    } finally { await loading.destroy(); }
  }
  const joined = text.join('\n\n');
  if (joined.length > 180000 || images.reduce((sum, image) => sum + image.length, 0) + joined.length > 23000000) throw new Error('Documento muito extenso. Divida-o em arquivos menores.');
  return { text: joined, images };
}