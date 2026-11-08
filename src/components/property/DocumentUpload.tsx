import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { FileText, Upload, Trash2, Eye, Loader2, Download, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { PdfCanvasViewer } from './PdfCanvasViewer';
import { deliverPdfBlob, isMobileBrowser, sharePreparedPdf } from '@/lib/pdf-delivery';
import { loadPrivateDocument } from '@/lib/private-document-loader';

interface PropertyDocument {
  id: string;
  property_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  document_type: string | null;
  uploaded_by: string | null;
  created_at: string;
}

interface DocumentUploadProps {
  propertyId: string;
  mode?: 'edit' | 'view';
}

export function DocumentUpload({ propertyId, mode = 'edit' }: DocumentUploadProps) {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<PropertyDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [pdfFileData, setPdfFileData] = useState<ArrayBuffer | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [viewingFileName, setViewingFileName] = useState<string>('');
  const [viewingDoc, setViewingDoc] = useState<PropertyDocument | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfFileUrlRef = useRef<string | null>(null);
  const viewRequestIdRef = useRef(0);

  useEffect(() => {
    fetchDocuments();
    const refresh = () => { if (document.visibilityState === 'visible') void fetchDocuments(); };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [propertyId]);

  useEffect(() => {
    return () => {
      if (pdfFileUrlRef.current?.startsWith('blob:')) {
        URL.revokeObjectURL(pdfFileUrlRef.current);
      }
    };
  }, []);

  const replacePdfFileUrl = (nextUrl: string | null) => {
    if (pdfFileUrlRef.current?.startsWith('blob:')) {
      URL.revokeObjectURL(pdfFileUrlRef.current);
    }

    pdfFileUrlRef.current = nextUrl;
  };

  const getDownloadFileName = (fileName: string) => {
    const trimmed = fileName.trim();
    return /\.pdf$/i.test(trimmed) ? trimmed : `${trimmed}.pdf`;
  };

  const resetPdfState = () => {
    setPdfBlob(null);
    setPdfFileData(null);
    replacePdfFileUrl(null);
  };

  const fetchDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('property_documents')
        .select('*')
        .eq('property_id', propertyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
      return data || [];
    } catch (error) {
      logger.error('Error fetching documents:', error);
      toast.error('Erro ao carregar documentos');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!user) {
      toast.error('Você precisa estar logado para enviar documentos');
      return;
    }

    if (file.type !== 'application/pdf') {
      toast.error('Apenas arquivos PDF são permitidos');
      return;
    }

    if (file.size > 12 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 12MB');
      return;
    }

    setIsUploading(true);
    try {
      const timestamp = Date.now();
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `${user.id}/${propertyId}/${timestamp}-${sanitizedFileName}`;

      const { error: uploadError } = await supabase.storage
        .from('property-documents')
        .upload(filePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: inserted, error: metaError } = await supabase
        .from('property_documents')
        .insert({
          property_id: propertyId,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          document_type: 'matricula',
          uploaded_by: user.id,
        })
        .select('*')
        .single();

      if (metaError) {
        await supabase.storage.from('property-documents').remove([filePath]);
        throw metaError;
      }

      if (inserted) {
        setDocuments((prev) => [inserted as PropertyDocument, ...prev]);
      }

      toast.success('Documento enviado com sucesso!');
    } catch (error: unknown) {
      logger.error('Error uploading document:', error);
      const message = error instanceof Error ? error.message : 'Erro ao enviar documento';
      toast.error(message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const loadDocumentFile = async (doc: PropertyDocument) => {
    const bucket = supabase.storage.from('property-documents');
    const data = await loadPrivateDocument({
      download: () => bucket.download(doc.file_path),
      createSignedUrl: () => bucket.createSignedUrl(doc.file_path, 60),
    });
    return {
      fileBlob: data,
      fileUrl: URL.createObjectURL(data),
      fileData: await data.arrayBuffer(),
    };
  };

  const handleView = async (doc: PropertyDocument) => {
    const requestId = viewRequestIdRef.current + 1;
    viewRequestIdRef.current = requestId;

    setViewingDoc(doc);
    setViewingFileName(doc.file_name);
    resetPdfState();
    setPdfViewerOpen(true);
    setIsLoadingPdf(true);

    try {
      const latest = await fetchDocuments();
      const replacements = latest?.filter(item => item.file_name === doc.file_name && item.document_type === doc.document_type);
      const currentDoc = latest?.find(item => item.id === doc.id) ?? (replacements?.length === 1 ? replacements[0] : undefined) ?? doc;
      if (viewRequestIdRef.current !== requestId) return;
      setViewingDoc(currentDoc);
      setViewingFileName(currentDoc.file_name);
      const { fileBlob, fileUrl, fileData } = await loadDocumentFile(currentDoc);

      if (viewRequestIdRef.current !== requestId) {
        URL.revokeObjectURL(fileUrl);
        return;
      }

      replacePdfFileUrl(fileUrl);
      setPdfBlob(fileBlob);
      setPdfFileData(fileData);
    } catch (error) {
      logger.error('Error viewing document:', error);
      toast.error('Erro ao abrir documento');

    } finally {
      if (viewRequestIdRef.current === requestId) {
        setIsLoadingPdf(false);
      }
    }
  };

  const closePdfViewer = () => {
    viewRequestIdRef.current += 1;
    setPdfViewerOpen(false);
    setViewingDoc(null);
    setViewingFileName('');
    setIsLoadingPdf(false);
    resetPdfState();
  };

  const handleDownload = async (doc: PropertyDocument) => {
    try {
      if (isMobileBrowser()) {
        if (viewingDoc?.id === doc.id && pdfBlob) {
          const result = await sharePreparedPdf(pdfBlob, getDownloadFileName(doc.file_name));
          if (result === 'cancelled') return;
          return;
        }

        const { fileBlob, fileUrl, fileData } = await loadDocumentFile(doc);
        setViewingDoc(doc);
        setViewingFileName(doc.file_name);
        replacePdfFileUrl(fileUrl);
        setPdfBlob(fileBlob);
        setPdfFileData(fileData);
        toast.success('PDF pronto. Toque novamente para compartilhar o arquivo.');
        return;
      }

      const { fileBlob: data, fileUrl } = await loadDocumentFile(doc);
      URL.revokeObjectURL(fileUrl);
      const result = await deliverPdfBlob(data, getDownloadFileName(doc.file_name));
      if (result === 'cancelled') return;
    } catch (error) {
      logger.error('Error downloading document:', error);
      toast.error('Erro ao baixar documento');
    }
  };

  const handleDelete = async (doc: PropertyDocument) => {
    if (!confirm(`Deseja realmente excluir "${doc.file_name}"?`)) return;

    try {
      const { error: storageError } = await supabase.storage
        .from('property-documents')
        .remove([doc.file_path]);

      if (storageError) throw storageError;

      const { error: metaError } = await supabase
        .from('property_documents')
        .delete()
        .eq('id', doc.id);

      if (metaError) throw metaError;

      toast.success('Documento excluído com sucesso!');
      fetchDocuments();
    } catch (error) {
      logger.error('Error deleting document:', error);
      toast.error('Erro ao excluir documento');
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="h-5 w-5 text-primary" />
          Documentos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {mode === 'edit' && (
          <div className="flex flex-col gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileChange}
              className="hidden"
              id="document-upload"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full gap-2"
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {isUploading ? 'Enviando...' : 'Enviar Documento (PDF)'}
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              Máximo 12MB • Apenas PDF
            </p>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-2 opacity-30" />
            <p>Nenhum documento anexado</p>
          </div>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3 bg-secondary rounded-lg gap-3"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <FileText className="h-8 w-8 text-primary shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate text-sm">{doc.file_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(doc.file_size)} • {formatDate(doc.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleView(doc)}
                    title="Visualizar"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(doc)}
                    title={isMobileBrowser() ? 'Compartilhar PDF' : 'Baixar'}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  {mode === 'edit' && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(doc)}
                      className="text-destructive hover:text-destructive"
                      title="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={pdfViewerOpen} onOpenChange={(open) => !open && closePdfViewer()}>
        <DialogContent aria-describedby={undefined} className="max-w-5xl w-[95vw] h-[90dvh] p-0 flex flex-col">
          <DialogHeader className="p-4 border-b flex-shrink-0">
            <DialogTitle className="flex items-center justify-between gap-3 pr-8">
              <div className="flex items-center gap-2 truncate">
                <FileText className="h-5 w-5 text-primary shrink-0" />
                <span className="truncate">{viewingFileName}</span>
              </div>
              <div className="flex items-center gap-2">
                {viewingDoc && (
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={() => handleDownload(viewingDoc)}
                    className="gap-2"
                    title={isMobileBrowser() ? 'Compartilhar PDF' : 'Baixar'}
                  >
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">{isMobileBrowser() ? 'Compartilhar' : 'Baixar'}</span>
                  </Button>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-hidden bg-muted relative">
            {isLoadingPdf ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : pdfFileData ? (
              <PdfCanvasViewer fileData={pdfFileData} fileName={viewingFileName} />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-4 p-6 text-center">
                <FileText className="h-16 w-16 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  Não foi possível carregar a matrícula.
                </p>
                {viewingDoc && (
                  <div className="flex gap-2">
                    <Button onClick={() => handleView(viewingDoc)} variant="outline" className="gap-2">
                      <RefreshCw className="h-4 w-4" />
                      Tentar novamente
                    </Button>
                    <Button onClick={() => handleDownload(viewingDoc)} className="gap-2">
                      <Download className="h-4 w-4" />
                      {isMobileBrowser() ? 'Compartilhar PDF' : 'Baixar PDF'}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
