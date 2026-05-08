import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Camera, Upload, X, Play, Loader2, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';

interface PropertyMediaUploadProps {
  propertyId: string;
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
}

const ACCEPTED_TYPES: Record<string, boolean> = {
  'image/jpeg': true,
  'image/png': true,
  'image/webp': true,
  'image/heic': true,
  'video/mp4': true,
  'video/quicktime': true,
  'video/webm': true,
};

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

function isVideo(url: string): boolean {
  return /\.(mp4|mov|webm)(\?|$)/i.test(url);
}

export function PropertyMediaUpload({ propertyId, photos, onPhotosChange }: PropertyMediaUploadProps) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [fileDragOver, setFileDragOver] = useState(false);
  const [reorderDragIndex, setReorderDragIndex] = useState<number | null>(null);
  const [reorderOverIndex, setReorderOverIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    if (!user) {
      toast.error('Usuário não autenticado');
      return;
    }

    const fileArray = Array.from(files);
    const invalidFiles = fileArray.filter(
      f => !(f.type in ACCEPTED_TYPES) || f.size > MAX_FILE_SIZE
    );

    if (invalidFiles.length > 0) {
      toast.error('Alguns arquivos são inválidos. Aceitos: JPG, PNG, WebP, MP4, MOV, WebM (máx 50MB)');
      return;
    }

    setUploading(true);
    const newUrls: string[] = [];

    try {
      for (const file of fileArray) {
        const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const fileName = `${user.id}/${propertyId}/${crypto.randomUUID()}.${ext}`;

        const { error } = await supabase.storage
          .from('property-media')
          .upload(fileName, file, { upsert: false });

        if (error) {
          logger.error('Upload error:', error);
          toast.error(`Erro ao enviar ${file.name}`);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from('property-media')
          .getPublicUrl(fileName);

        newUrls.push(urlData.publicUrl);
      }

      if (newUrls.length > 0) {
        onPhotosChange([...photos, ...newUrls]);
        toast.success(`${newUrls.length} arquivo(s) enviado(s) com sucesso!`);
      }
    } catch (error) {
      logger.error('Upload error:', error);
      toast.error('Erro ao enviar arquivos');
    } finally {
      setUploading(false);
    }
  }, [user, propertyId, photos, onPhotosChange]);

  const handleRemove = useCallback(async (url: string) => {
    const bucketUrl = supabase.storage.from('property-media').getPublicUrl('').data.publicUrl;
    const filePath = url.replace(bucketUrl, '');

    try {
      const { error } = await supabase.storage
        .from('property-media')
        .remove([filePath]);

      if (error) {
        logger.error('Delete error:', error);
      }
    } catch {
      // Ignore delete errors, still remove from list
    }

    onPhotosChange(photos.filter(p => p !== url));
    toast.success('Arquivo removido');
  }, [photos, onPhotosChange]);

  // File upload drop zone handlers
  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setFileDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  }, [uploadFiles]);

  const handleFileDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setFileDragOver(true);
  }, []);

  const handleFileDragLeave = useCallback(() => {
    setFileDragOver(false);
  }, []);

  // Reorder drag handlers
  const handleReorderDragStart = useCallback((e: React.DragEvent, index: number) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    setReorderDragIndex(index);
  }, []);

  const handleReorderDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setReorderOverIndex(index);
  }, []);

  const handleReorderDrop = useCallback((e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    const sourceIndex = Number(e.dataTransfer.getData('text/plain'));
    if (isNaN(sourceIndex) || sourceIndex === targetIndex) {
      setReorderDragIndex(null);
      setReorderOverIndex(null);
      return;
    }

    const updated = [...photos];
    const [moved] = updated.splice(sourceIndex, 1);
    updated.splice(targetIndex, 0, moved);
    onPhotosChange(updated);
    setReorderDragIndex(null);
    setReorderOverIndex(null);
  }, [photos, onPhotosChange]);

  const handleReorderDragEnd = useCallback(() => {
    setReorderDragIndex(null);
    setReorderOverIndex(null);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Camera className="h-5 w-5 text-primary" />
          Fotos e Vídeos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Drop zone for file uploads */}
        <div
          onDrop={handleFileDrop}
          onDragOver={handleFileDragOver}
          onDragLeave={handleFileDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
            fileDragOver
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
          )}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Enviando...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">Arraste arquivos ou clique para selecionar</p>
              <p className="text-sm text-muted-foreground">JPG, PNG, WebP, MP4, MOV, WebM • Máx 50MB</p>
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/heic,video/mp4,video/quicktime,video/webm"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              uploadFiles(e.target.files);
              e.target.value = '';
            }
          }}
        />

        {/* Reorderable media grid */}
        {photos.length > 0 && (
          <>
            <p className="text-sm text-muted-foreground">Arraste para reordenar</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {photos.map((url, index) => (
                <div
                  key={url}
                  draggable
                  onDragStart={(e) => handleReorderDragStart(e, index)}
                  onDragOver={(e) => handleReorderDragOver(e, index)}
                  onDrop={(e) => handleReorderDrop(e, index)}
                  onDragEnd={handleReorderDragEnd}
                  className={cn(
                    "relative group aspect-square rounded-lg overflow-hidden bg-muted cursor-grab active:cursor-grabbing transition-all",
                    reorderDragIndex === index && "opacity-40 scale-95",
                    reorderOverIndex === index && reorderDragIndex !== index && "ring-2 ring-primary ring-offset-1"
                  )}
                >
                  {isVideo(url) ? (
                    <div className="w-full h-full flex items-center justify-center bg-black/80">
                      <video src={url} className="w-full h-full object-cover" muted preload="metadata" />
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <Play className="h-8 w-8 text-white/80" />
                      </div>
                    </div>
                  ) : (
                    <img
                      src={url}
                      alt={`Mídia ${index + 1}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      draggable={false}
                    />
                  )}
                  {/* Grip indicator */}
                  <div className="absolute top-1 left-1 h-5 w-5 rounded bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <GripVertical className="h-3 w-3 text-white" />
                  </div>
                  {/* Position badge */}
                  <div className="absolute bottom-1 left-1 h-5 min-w-5 px-1 rounded bg-black/50 flex items-center justify-center">
                    <span className="text-[13px] text-white font-medium">{index + 1}</span>
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(url);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </>
        )}

        {photos.length > 0 && (
          <p className="text-sm text-muted-foreground text-right">
            {photos.length} arquivo(s)
          </p>
        )}
      </CardContent>
    </Card>
  );
}
