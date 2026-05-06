import { useEffect, useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

interface PdfCanvasViewerProps {
  fileData: ArrayBuffer | null;
  fileName: string;
}

const TARGET_PAGE_WIDTH = 920;
const MIN_SCALE = 1.1;
const MAX_SCALE = 1.8;

const canvasToBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }

      reject(new Error('Falha ao converter página do PDF.'));
    }, 'image/png');
  });

export function PdfCanvasViewer({ fileData, fileName }: PdfCanvasViewerProps) {
  const [pageImageUrls, setPageImageUrls] = useState<string[]>([]);
  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const createdUrls: string[] = [];

    const revokeUrls = (urls: string[]) => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };

    const renderPdf = async () => {
      setPageImageUrls([]);
      setRenderError(null);

      if (!fileData) {
        return;
      }

      setIsRendering(true);

      try {
        const loadingTask = getDocument({ data: new Uint8Array(fileData) });
        const pdf = await loadingTask.promise;
        const nextUrls: string[] = [];

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          if (cancelled) {
            break;
          }

          const page = await pdf.getPage(pageNumber);
          const baseViewport = page.getViewport({ scale: 1 });
          const computedScale = TARGET_PAGE_WIDTH / baseViewport.width;
          const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, computedScale));
          const viewport = page.getViewport({ scale });
          const outputScale = window.devicePixelRatio || 1;
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d', { alpha: false });

          if (!context) {
            throw new Error('Falha ao criar canvas do PDF.');
          }

          canvas.width = Math.floor(viewport.width * outputScale);
          canvas.height = Math.floor(viewport.height * outputScale);

          const transform = outputScale === 1
            ? undefined
            : [outputScale, 0, 0, outputScale, 0, 0] as [number, number, number, number, number, number];

          await page.render({
            canvas,
            canvasContext: context,
            viewport,
            transform,
          }).promise;

          const blob = await canvasToBlob(canvas);
          const url = URL.createObjectURL(blob);
          createdUrls.push(url);
          nextUrls.push(url);
        }

        void loadingTask.destroy();
        void pdf.cleanup();

        if (cancelled) {
          revokeUrls(nextUrls);
          return;
        }

        setPageImageUrls(nextUrls);
      } catch (error) {
        revokeUrls(createdUrls);

        if (!cancelled) {
          setRenderError('Não foi possível renderizar a matrícula no visualizador.');
        }
      } finally {
        if (!cancelled) {
          setIsRendering(false);
        }
      }
    };

    void renderPdf();

    return () => {
      cancelled = true;
      revokeUrls(createdUrls);
    };
  }, [fileData]);

  if (isRendering) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Renderizando a matrícula...</p>
        </div>
      </div>
    );
  }

  if (renderError) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="flex max-w-md flex-col items-center gap-3 text-center">
          <FileText className="h-12 w-12 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">{renderError}</p>
        </div>
      </div>
    );
  }

  if (!fileData || pageImageUrls.length === 0) {
    return null;
  }

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto flex max-w-4xl flex-col gap-4 p-4">
        {pageImageUrls.map((pageImageUrl, index) => (
          <img
            key={`${pageImageUrl}-${index}`}
            src={pageImageUrl}
            alt={`Página ${index + 1} da matrícula ${fileName}`}
            className="w-full rounded-lg border border-border bg-background shadow-sm"
            loading="lazy"
          />
        ))}
      </div>
    </div>
  );
}
