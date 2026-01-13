import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { FileText, Upload, Trash2, Eye, Loader2, Download, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

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
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [viewingFileName, setViewingFileName] = useState<string>('');
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchDocuments();
  }, [propertyId]);

  const fetchDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('property_documents')
        .select('*')
        .eq('property_id', propertyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast.error('Erro ao carregar documentos');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (file.type !== 'application/pdf') {
      toast.error('Apenas arquivos PDF são permitidos');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 10MB');
      return;
    }

    setIsUploading(true);
    try {
      // Generate unique file path
      const timestamp = Date.now();
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `${propertyId}/${timestamp}-${sanitizedFileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('property-documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Save metadata
      const { error: metaError } = await supabase
        .from('property_documents')
        .insert({
          property_id: propertyId,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          document_type: 'matricula',
          uploaded_by: user?.id
        });

      if (metaError) throw metaError;

      toast.success('Documento enviado com sucesso!');
      fetchDocuments();
    } catch (error: any) {
      console.error('Error uploading document:', error);
      toast.error(error.message || 'Erro ao enviar documento');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleView = async (doc: PropertyDocument) => {
    setIsLoadingPdf(true);
    setViewingFileName(doc.file_name);
    setPdfViewerOpen(true);
    
    try {
      const { data, error } = await supabase.storage
        .from('property-documents')
        .download(doc.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      setPdfBlobUrl(url);
    } catch (error) {
      console.error('Error viewing document:', error);
      toast.error('Erro ao abrir documento');
      setPdfViewerOpen(false);
    } finally {
      setIsLoadingPdf(false);
    }
  };

  const closePdfViewer = () => {
    setPdfViewerOpen(false);
    if (pdfBlobUrl) {
      URL.revokeObjectURL(pdfBlobUrl);
      setPdfBlobUrl(null);
    }
    setViewingFileName('');
  };

  const handleDownload = async (doc: PropertyDocument) => {
    try {
      const { data, error } = await supabase.storage
        .from('property-documents')
        .download(doc.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading document:', error);
      toast.error('Erro ao baixar documento');
    }
  };

  const handleDelete = async (doc: PropertyDocument) => {
    if (!confirm(`Deseja realmente excluir "${doc.file_name}"?`)) return;

    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('property-documents')
        .remove([doc.file_path]);

      if (storageError) throw storageError;

      // Delete metadata
      const { error: metaError } = await supabase
        .from('property_documents')
        .delete()
        .eq('id', doc.id);

      if (metaError) throw metaError;

      toast.success('Documento excluído com sucesso!');
      fetchDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
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
            <p className="text-xs text-muted-foreground text-center">
              Máximo 10MB • Apenas PDF
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
                    <p className="text-xs text-muted-foreground">
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
                    title="Baixar"
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

      {/* PDF Viewer Dialog */}
      <Dialog open={pdfViewerOpen} onOpenChange={(open) => !open && closePdfViewer()}>
        <DialogContent className="max-w-5xl w-[95vw] h-[90vh] p-0 flex flex-col">
          <DialogHeader className="p-4 border-b flex-shrink-0">
            <DialogTitle className="flex items-center justify-between gap-2 pr-8">
              <div className="flex items-center gap-2 truncate">
                <FileText className="h-5 w-5 text-primary shrink-0" />
                <span className="truncate">{viewingFileName}</span>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {isLoadingPdf ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : pdfBlobUrl ? (
              <iframe
                src={pdfBlobUrl}
                className="w-full h-full border-0"
                title={viewingFileName}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
