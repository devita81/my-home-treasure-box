const MOBILE_USER_AGENT_RE = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

export type PdfDeliveryResult = 'shared' | 'downloaded' | 'saved' | 'cancelled';

export const isMobileBrowser = () => {
  if (typeof navigator === 'undefined') {
    return false;
  }

  return MOBILE_USER_AGENT_RE.test(navigator.userAgent || '');
};

const normalizePdfFileName = (fileName: string) => {
  const trimmed = fileName.trim();
  const safeName = trimmed.replace(/[\\/:*?"<>|]+/g, '-');
  return /\.pdf$/i.test(safeName) ? safeName : `${safeName}.pdf`;
};

export const createPdfFile = (blob: Blob, fileName: string) => new File([blob], normalizePdfFileName(fileName), {
  type: 'application/pdf',
  lastModified: Date.now(),
});

export const canSharePdfFile = (file: File) => {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return false;
  }

  if (typeof navigator.canShare !== 'function') {
    return true;
  }

  try {
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
};

const triggerBlobDownload = (blob: Blob, fileName: string) => {
  const blobUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = normalizePdfFileName(fileName);
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
};

export async function sharePreparedPdf(blob: Blob, fileName: string): Promise<PdfDeliveryResult> {
  const pdfFile = createPdfFile(blob, fileName);

  if (!canSharePdfFile(pdfFile)) {
    triggerBlobDownload(blob, pdfFile.name);
    return isMobileBrowser() ? 'downloaded' : 'saved';
  }

  try {
    await navigator.share({ files: [pdfFile] });
    return 'shared';
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      return 'cancelled';
    }

    throw error;
  }
}

export async function deliverPdfBlob(blob: Blob, fileName: string): Promise<PdfDeliveryResult> {
  const isMobile = isMobileBrowser();
  const pdfFile = createPdfFile(blob, fileName);

  if (isMobile && canSharePdfFile(pdfFile)) {
    try {
      await navigator.share({ files: [pdfFile] });
      return 'shared';
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        return 'cancelled';
      }
    }
  }

  triggerBlobDownload(blob, pdfFile.name);
  return isMobile ? 'downloaded' : 'saved';
}
