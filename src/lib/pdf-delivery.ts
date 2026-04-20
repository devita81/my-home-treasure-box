const MOBILE_USER_AGENT_RE = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

export type PdfDeliveryResult = 'shared' | 'downloaded' | 'saved' | 'cancelled';

export const isMobileBrowser = () => {
  if (typeof navigator === 'undefined') {
    return false;
  }

  return MOBILE_USER_AGENT_RE.test(navigator.userAgent || '');
};

const triggerBlobDownload = (blob: Blob, fileName: string) => {
  const blobUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
};

export async function deliverPdfBlob(blob: Blob, fileName: string): Promise<PdfDeliveryResult> {
  const isMobile = isMobileBrowser();
  const pdfFile = new File([blob], fileName, {
    type: 'application/pdf',
    lastModified: Date.now(),
  });

  if (isMobile && typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ files: [pdfFile] });
      return 'shared';
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        return 'cancelled';
      }
    }
  }

  triggerBlobDownload(blob, fileName);
  return isMobile ? 'downloaded' : 'saved';
}