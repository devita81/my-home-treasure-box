import { PDFDocument } from 'pdf-lib';
import { supabase } from '@/integrations/supabase/client';
import { validateMatriculaFiles, MAX_DOCUMENT_BYTES } from './matricula-reader';

export async function prepareMatriculaAttachments(files: readonly File[]): Promise<File[]> {
  validateMatriculaFiles(files);
  const documents = files.filter(file => file.type === 'application/pdf');
  const images = files.filter(file => file.type !== 'application/pdf');
  if (!images.length) return documents;
  const pdf = await PDFDocument.create();
  // Stable metadata makes identical source pages produce the same content hash.
  pdf.setCreationDate(new Date('2000-01-01T00:00:00Z'));
  pdf.setModificationDate(new Date('2000-01-01T00:00:00Z'));
  for (const file of images) {
    const bytes = await file.arrayBuffer();
    let image;
    if (file.type === 'image/jpeg') image = await pdf.embedJpg(bytes);
    else if (file.type === 'image/png') image = await pdf.embedPng(bytes);
    else {
      const bitmap = await createImageBitmap(file);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width; canvas.height = bitmap.height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Não foi possível preparar as fotos.');
        context.drawImage(bitmap, 0, 0);
        const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Imagem inválida.')), 'image/png'));
        image = await pdf.embedPng(await blob.arrayBuffer());
      } finally { bitmap.close(); }
    }
    const scale = Math.min(595 / image.width, 842 / image.height);
    const width = image.width * scale; const height = image.height * scale;
    const page = pdf.addPage([width, height]);
    page.drawImage(image, { x: 0, y: 0, width, height });
  }
  const bytes = await pdf.save();
  if (bytes.byteLength > MAX_DOCUMENT_BYTES) throw new Error('O PDF das fotos ultrapassa 12 MB.');
  return [...documents, new File([new Uint8Array(bytes)], 'Matricula-e-escritura-fotos.pdf', { type: 'application/pdf' })];
}

export async function attachMatriculaDocuments(propertyId: string, documents: readonly File[]) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Faça login para anexar a matrícula.');
  for (const file of documents) {
    if (file.type !== 'application/pdf' || file.size > MAX_DOCUMENT_BYTES) throw new Error('Matrícula inválida.');
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()))).map(value => value.toString(16).padStart(2, '0')).join('');
    const path = `${user.id}/${propertyId}/matricula-${hash}.pdf`;
    const { data: existing, error: lookupError } = await supabase.from('property_documents').select('id').eq('property_id', propertyId).eq('file_path', path).limit(1);
    if (lookupError) throw lookupError;
    if (existing?.length) continue;
    const { error: uploadError } = await supabase.storage.from('property-documents').upload(path, file, { contentType: 'application/pdf', upsert: true });
    if (uploadError) throw uploadError;
    const { error: metadataError } = await supabase.from('property_documents').insert({ property_id: propertyId, file_name: file.name, file_path: path, file_size: file.size, document_type: 'matricula', uploaded_by: user.id });
    if (metadataError) {
      await supabase.storage.from('property-documents').remove([path]);
      throw metadataError;
    }
  }
}