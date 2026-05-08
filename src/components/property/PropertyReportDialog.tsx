import { useState, useEffect, useCallback } from 'react';
import { Property } from '@/types/property';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileText, Send, Download, Loader2, Eye, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { ScrollArea } from '@/components/ui/scroll-area';
import { deliverPdfBlob, isMobileBrowser, sharePreparedPdf } from '@/lib/pdf-delivery';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// jspdf-autotable adds 'lastAutoTable' to the jsPDF instance at runtime
// but the type augmentation isn't always picked up — declare it here so
// 'doc.lastAutoTable.finalY' is properly typed instead of needing 'as any'.
declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable: { finalY: number };
  }
}

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

interface PropertyReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  property: Property;
}

const formatCurrency = (value: number | null | undefined) => {
  if (!value) return '-';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(value);
};

const formatNumber = (value: number | null | undefined) => {
  if (!value && value !== 0) return '-';
  return new Intl.NumberFormat('pt-BR').format(value);
};

const getFullAddress = (p: Property) => {
  const parts = [p.rua];
  if (p.numero) parts.push(p.numero);
  if (p.apartamento) parts.push(`Apto ${p.apartamento}`);
  if (p.complemento) parts.push(p.complemento);
  return `${parts.join(', ')} — ${p.bairro}, ${p.cidade}/${p.estado}`;
};

const getStatus = (p: Property) => {
  if (p.vendido) return 'Vendido';
  if (p.alugado) return 'Alugado';
  return 'Disponível';
};

// Generate a static map image using OSM tiles rendered on a canvas
async function generateMapImage(lat: number, lng: number, width = 600, height = 300, zoom = 16): Promise<string | null> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) { resolve(null); return; }

    // Calculate tile coordinates
    const n = Math.pow(2, zoom);
    const centerTileX = ((lng + 180) / 360) * n;
    const centerTileY = (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n;

    const tileSize = 256;
    const tilesX = Math.ceil(width / tileSize) + 1;
    const tilesY = Math.ceil(height / tileSize) + 1;

    const offsetX = (width / 2) - ((centerTileX % 1) * tileSize);
    const offsetY = (height / 2) - ((centerTileY % 1) * tileSize);

    const startTileX = Math.floor(centerTileX) - Math.floor(tilesX / 2);
    const startTileY = Math.floor(centerTileY) - Math.floor(tilesY / 2);

    let loaded = 0;
    const totalTiles = tilesX * tilesY;
    let hasResolved = false;

    const tryResolve = () => {
      if (hasResolved) return;
      loaded++;
      if (loaded >= totalTiles) {
        hasResolved = true;
        // Draw marker (red circle with white border)
        const markerX = width / 2;
        const markerY = height / 2;
        ctx.beginPath();
        ctx.arc(markerX, markerY, 10, 0, Math.PI * 2);
        ctx.fillStyle = '#dc2626';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(markerX, markerY, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        resolve(canvas.toDataURL('image/png'));
      }
    };

    // Timeout fallback
    setTimeout(() => {
      if (!hasResolved) { hasResolved = true; resolve(loaded > 0 ? canvas.toDataURL('image/png') : null); }
    }, 8000);

    for (let x = 0; x < tilesX; x++) {
      for (let y = 0; y < tilesY; y++) {
        const tileX = startTileX + x;
        const tileY = startTileY + y;
        

        const img = new Image();
        img.crossOrigin = 'anonymous';
        const dx = offsetX + (tileX - Math.floor(centerTileX)) * tileSize;
        const dy = offsetY + (tileY - Math.floor(centerTileY)) * tileSize;
        img.onload = () => {
          ctx.drawImage(img, dx, dy, tileSize, tileSize);
          tryResolve();
        };
        img.onerror = () => tryResolve();
        img.src = `https://tile.openstreetmap.org/${zoom}/${((tileX % n) + n) % n}/${tileY}.png`;
      }
    }
  });
}

async function loadImageAsBase64(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(null); return; }
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => resolve(null);
    setTimeout(() => resolve(null), 10000);
    img.src = url;
  });
}

async function fetchPropertyMatriculaPdfs(propertyId: string): Promise<{ name: string; data: ArrayBuffer }[]> {
  try {
    const { data: docs, error } = await supabase
      .from('property_documents')
      .select('file_name, file_path')
      .eq('property_id', propertyId);
    if (error || !docs) return [];

    const results: { name: string; data: ArrayBuffer }[] = [];
    for (const d of docs) {
      // Only include PDFs
      if (!/\.pdf(\?|$)/i.test(d.file_name)) continue;
      const { data: blob, error: dlErr } = await supabase.storage
        .from('property-documents')
        .download(d.file_path);
      if (dlErr || !blob) continue;
      results.push({ name: d.file_name, data: await blob.arrayBuffer() });
    }
    return results;
  } catch (e) {
    logger.error('Error fetching matrícula PDFs:', e);
    return [];
  }
}

async function appendPdfPagesToReport(doc: jsPDF, pdfBuffer: ArrayBuffer, label: string): Promise<void> {
  try {
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer) });
    const pdf = await loadingTask.promise;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      // Render at higher scale for clarity
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      const imgData = canvas.toDataURL('image/jpeg', 0.85);

      doc.addPage();
      // Header label on first page
      if (pageNum === 1) {
        doc.setFillColor(30, 58, 45);
        doc.rect(0, 0, pageWidth, 14, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(label, margin, 9);
      }
      const topOffset = pageNum === 1 ? 18 : margin;
      const availW = pageWidth - margin * 2;
      const availH = pageHeight - topOffset - margin;
      const ratio = Math.min(availW / viewport.width, availH / viewport.height);
      const drawW = viewport.width * ratio;
      const drawH = viewport.height * ratio;
      const x = (pageWidth - drawW) / 2;
      doc.addImage(imgData, 'JPEG', x, topOffset, drawW, drawH);
    }
  } catch (e) {
    logger.error('Error appending PDF pages:', e);
  }
}

async function generatePropertyPDF(property: Property): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // Header bar
  doc.setFillColor(30, 58, 45);
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Relatório Individual de Imóvel', margin, 12);
  doc.setFontSize(8);
  doc.text(
    `Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
    margin, 20
  );

  let yPos = 38;

  // --- PROPERTY TITLE ---
  doc.setTextColor(30, 58, 45);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`${property.tipo_imovel || 'Imóvel'} — ${property.cidade}/${property.estado}`, margin, yPos);
  yPos += 5;

  // Status
  const status = getStatus(property);
  const validado = property.validado ? 'Validado' : 'Pendente';
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`Status: ${status}  |  Validação: ${validado}`, margin, yPos + 4);
  yPos += 12;

  // --- MAP IMAGE ---
  if (property.latitude && property.longitude) {
    try {
      const base64 = await generateMapImage(property.latitude, property.longitude);
      if (base64) {
        const imgWidth = contentWidth;
        const imgHeight = imgWidth * 0.5;
        if (yPos + imgHeight > 270) {
          doc.addPage();
          yPos = 18;
        }
        doc.addImage(base64, 'PNG', margin, yPos, imgWidth, imgHeight);
        yPos += imgHeight + 6;
      } else {
        doc.setDrawColor(210, 216, 210);
        doc.setFillColor(247, 249, 247);
        doc.roundedRect(margin, yPos, contentWidth, 24, 1, 1, 'FD');
        doc.setFontSize(9);
        doc.setTextColor(110, 110, 110);
        doc.text('Mapa indisponível para este imóvel.', margin + 4, yPos + 14);
        yPos += 30;
      }
    } catch (e) {
      logger.error('Map image error:', e);
      doc.setDrawColor(210, 216, 210);
      doc.setFillColor(247, 249, 247);
      doc.roundedRect(margin, yPos, contentWidth, 24, 1, 1, 'FD');
      doc.setFontSize(9);
      doc.setTextColor(110, 110, 110);
      doc.text('Mapa indisponível para este imóvel.', margin + 4, yPos + 14);
      yPos += 30;
    }
  }

  // --- ADDRESS ---
  doc.setFillColor(240, 244, 240);
  doc.roundedRect(margin, yPos, contentWidth, 8, 1, 1, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 45);
  doc.text('ENDEREÇO COMPLETO', margin + 3, yPos + 5.5);
  yPos += 12;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 30, 30);
  const addressLines = doc.splitTextToSize(getFullAddress(property), contentWidth);
  doc.text(addressLines, margin, yPos);
  yPos += addressLines.length * 5 + 6;

  // --- CHARACTERISTICS TABLE ---
  doc.setFillColor(240, 244, 240);
  doc.roundedRect(margin, yPos, contentWidth, 8, 1, 1, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 45);
  doc.text('CARACTERÍSTICAS DO IMÓVEL', margin + 3, yPos + 5.5);
  yPos += 12;

  const charData: string[][] = [];
  const isTerrenoType = (property.tipo_imovel || '').toLowerCase() === 'terreno';
  charData.push(['Tipo de Imóvel', property.tipo_imovel || '-']);
  if (property.metragem) charData.push(['Metragem Privativa', `${formatNumber(property.metragem)} m²`]);
  if (property.area_comum) charData.push(['Área Comum', `${formatNumber(property.area_comum)} m²`]);
  if (property.area_total) charData.push(['Área Total', `${formatNumber(property.area_total)} m²`]);
  if (!isTerrenoType) {
    charData.push(['Quartos', String(property.quartos || 0)]);
    charData.push(['Suítes', String(property.suites || 0)]);
    charData.push(['Banheiros', String(property.banheiros || 0)]);
    charData.push(['Vagas de Garagem', String(property.garagens || 0)]);
  }
  if (property.ano_construcao) charData.push(['Ano de Construção', String(property.ano_construcao)]);

  autoTable(doc, {
    startY: yPos,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    theme: 'striped',
    headStyles: { fillColor: [30, 58, 45], fontSize: 8, fontStyle: 'bold', cellPadding: 2 },
    bodyStyles: { fontSize: 8, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: 'bold', textColor: [80, 80, 80], cellWidth: 55 } },
    head: [['Característica', 'Valor']],
    body: charData,
  });
  yPos = doc.lastAutoTable.finalY + 8;

  // --- FINANCIAL TABLE (IPTU + Condomínio only) ---
  const finData: string[][] = [];
  if (property.iptu_value) finData.push(['IPTU Mensal', formatCurrency(property.iptu_value)]);
  if (property.valor_condominio) finData.push(['Condomínio Mensal', formatCurrency(property.valor_condominio)]);
  if (property.valor_aluguel) finData.push(['Aluguel Mensal', formatCurrency(property.valor_aluguel)]);
  if (property.taxa_administracao) finData.push(['Taxa de Administração', formatCurrency(property.taxa_administracao)]);

  if (finData.length > 0) {
    if (yPos > 230) { doc.addPage(); yPos = 18; }
    doc.setFillColor(240, 244, 240);
    doc.roundedRect(margin, yPos, contentWidth, 8, 1, 1, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 45);
    doc.text('CUSTOS', margin + 3, yPos + 5.5);
    yPos += 12;

    autoTable(doc, {
      startY: yPos,
      margin: { left: margin, right: margin },
      tableWidth: contentWidth,
      theme: 'striped',
      headStyles: { fillColor: [30, 58, 45], fontSize: 8, fontStyle: 'bold', cellPadding: 2 },
      bodyStyles: { fontSize: 8, cellPadding: 2 },
      columnStyles: { 0: { fontStyle: 'bold', textColor: [80, 80, 80], cellWidth: 55 } },
      head: [['Item', 'Valor']],
      body: finData,
    });
    yPos = doc.lastAutoTable.finalY + 8;
  }

  // --- OWNERSHIP TABLE ---
  if (property.proprietario_matricula || property.proprietario_papel) {
    if (yPos > 230) { doc.addPage(); yPos = 18; }
    doc.setFillColor(240, 244, 240);
    doc.roundedRect(margin, yPos, contentWidth, 8, 1, 1, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 45);
    doc.text('DADOS DE PROPRIEDADE', margin + 3, yPos + 5.5);
    yPos += 12;

    const ownerData: string[][] = [];
    if (property.proprietario_matricula)
      ownerData.push(['Proprietário Matrícula', `${property.proprietario_matricula} (${property.percentual_proprietario_matricula ?? 100}%)`]);
    if (property.proprietario_matricula_ii)
      ownerData.push(['Proprietário Matrícula II', `${property.proprietario_matricula_ii} (${property.percentual_proprietario_matricula_ii ?? 0}%)`]);
    if (property.numero_matricula)
      ownerData.push(['Nº Matrícula', property.numero_matricula]);
    if (property.numero_contribuinte)
      ownerData.push(['Nº Contribuinte', property.numero_contribuinte]);
    if (property.inquilino)
      ownerData.push(['Inquilino', property.inquilino]);

    autoTable(doc, {
      startY: yPos,
      margin: { left: margin, right: margin },
      tableWidth: contentWidth,
      theme: 'striped',
      headStyles: { fillColor: [100, 120, 100], fontSize: 8, fontStyle: 'bold', cellPadding: 2 },
      bodyStyles: { fontSize: 8, cellPadding: 2 },
      columnStyles: { 0: { fontStyle: 'bold', textColor: [80, 80, 80], cellWidth: 55 } },
      head: [['Campo', 'Informação']],
      body: ownerData,
    });
  }

  // --- PHOTOS ---
  const photos = (property.photos || []).filter(url => !/\.(mp4|mov|webm)(\?|$)/i.test(url));
  if (photos.length > 0) {
    doc.addPage();
    yPos = 18;

    doc.setFillColor(240, 244, 240);
    doc.roundedRect(margin, yPos, contentWidth, 8, 1, 1, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 45);
    doc.text('FOTOS DO IMÓVEL', margin + 3, yPos + 5.5);
    yPos += 12;

    const photoWidth = (contentWidth - 4) / 2; // 2 columns with 4mm gap
    const photoHeight = photoWidth * 0.75;

    for (let i = 0; i < photos.length; i++) {
      try {
        const imgData = await loadImageAsBase64(photos[i]);
        if (!imgData) continue;

        const col = i % 2;
        if (col === 0 && i > 0) {
          // New row
        }

        const xPos = margin + col * (photoWidth + 4);

        if (col === 0 && yPos + photoHeight > 280) {
          doc.addPage();
          yPos = 18;
        }

        doc.addImage(imgData, 'JPEG', xPos, yPos, photoWidth, photoHeight);

        if (col === 1 || i === photos.length - 1) {
          yPos += photoHeight + 4;
        }
      } catch (e) {
        logger.error('Photo load error:', e);
      }
    }
  }

  // --- APPEND MATRÍCULA PDFs ---
  const matriculaPdfs = await fetchPropertyMatriculaPdfs(property.id);
  for (const pdfFile of matriculaPdfs) {
    await appendPdfPagesToReport(doc, pdfFile.data, `Documento: ${pdfFile.name}`);
  }

  return doc;
}

function ReportPreview({ property }: { property: Property }) {
  const address = getFullAddress(property);
  const status = getStatus(property);
  const validado = property.validado ? 'Validado' : 'Pendente';
  const hasCoords = !!(property.latitude && property.longitude);

  const isTerrenoType = (property.tipo_imovel || '').toLowerCase() === 'terreno';
  const charRows: [string, string][] = [
    ['Tipo de Imóvel', property.tipo_imovel || '-'],
  ];
  if (property.metragem) charRows.push(['Metragem Privativa', `${formatNumber(property.metragem)} m²`]);
  if (property.area_comum) charRows.push(['Área Comum', `${formatNumber(property.area_comum)} m²`]);
  if (property.area_total) charRows.push(['Área Total', `${formatNumber(property.area_total)} m²`]);
  if (!isTerrenoType) {
    charRows.push(['Quartos', String(property.quartos || 0)]);
    charRows.push(['Suítes', String(property.suites || 0)]);
    charRows.push(['Banheiros', String(property.banheiros || 0)]);
    charRows.push(['Vagas de Garagem', String(property.garagens || 0)]);
  }
  if (property.ano_construcao) charRows.push(['Ano de Construção', String(property.ano_construcao)]);

  const finRows: [string, string][] = [];
  if (property.iptu_value) finRows.push(['IPTU Mensal', formatCurrency(property.iptu_value)]);
  if (property.valor_condominio) finRows.push(['Condomínio Mensal', formatCurrency(property.valor_condominio)]);
  if (property.valor_aluguel) finRows.push(['Aluguel Mensal', formatCurrency(property.valor_aluguel)]);
  if (property.taxa_administracao) finRows.push(['Taxa de Administração', formatCurrency(property.taxa_administracao)]);

  const ownerRows: [string, string][] = [];
  if (property.proprietario_matricula)
    ownerRows.push(['Proprietário Matrícula', `${property.proprietario_matricula} (${property.percentual_proprietario_matricula ?? 100}%)`]);
  if (property.proprietario_matricula_ii)
    ownerRows.push(['Proprietário Matrícula II', `${property.proprietario_matricula_ii} (${property.percentual_proprietario_matricula_ii ?? 0}%)`]);
  if (property.numero_matricula)
    ownerRows.push(['Nº Matrícula', property.numero_matricula]);
  if (property.numero_contribuinte)
    ownerRows.push(['Nº Contribuinte', property.numero_contribuinte]);
  if (property.inquilino)
    ownerRows.push(['Inquilino', property.inquilino]);

  const SectionHeader = ({ title }: { title: string }) => (
    <div className="bg-[hsl(145,30%,94%)] rounded px-2 py-1.5 mb-2">
      <span className="text-[13px] font-bold uppercase tracking-wide text-[hsl(145,30%,25%)]">{title}</span>
    </div>
  );

  const DataTable = ({ rows }: { rows: [string, string][] }) => (
    <div className="border border-border rounded overflow-hidden mb-3">
      {rows.map(([label, value], i) => (
        <div key={i} className={`flex text-[13px] px-2 py-1 ${i % 2 === 0 ? 'bg-muted/30' : ''}`}>
          <span className="font-semibold text-muted-foreground w-[120px] shrink-0">{label}</span>
          <span className="text-foreground">{value}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
      {/* Header */}
      <div className="bg-[hsl(145,30%,18%)] px-4 py-3">
        <p className="text-[12px] font-medium text-white/90">Relatório Individual de Imóvel</p>
        <p className="text-[12px] text-white/60">
          Gerado em {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>

      {/* Title */}
      <div className="px-4 pt-3 pb-1">
        <p className="text-sm font-bold text-[hsl(145,30%,25%)]">
          {property.tipo_imovel || 'Imóvel'} — {property.cidade}/{property.estado}
        </p>
        <p className="text-[12px] text-muted-foreground">Status: {status}  |  Validação: {validado}</p>
      </div>

      {/* Map */}
      {hasCoords && (
        <div className="px-4 pt-2">
          <div
            className="relative w-full overflow-hidden rounded border border-border"
            style={{ height: 160 }}
          >
            <iframe
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${property.longitude! - 0.005},${property.latitude! - 0.003},${property.longitude! + 0.005},${property.latitude! + 0.003}&layer=mapnik&marker=${property.latitude},${property.longitude}`}
              className="absolute left-0 top-0 w-full"
              style={{ height: 200 }}
              title="Mapa do imóvel"
            />
          </div>
        </div>
      )}

      <div className="px-4 py-3 space-y-2">
        {/* Address */}
        <SectionHeader title="Endereço Completo" />
        <p className="text-[13px] text-foreground mb-3">{address}</p>

        {/* Characteristics */}
        <SectionHeader title="Características do Imóvel" />
        <DataTable rows={charRows} />

        {/* Financials */}
        {finRows.length > 0 && (
          <>
            <SectionHeader title="Custos" />
            <DataTable rows={finRows} />
          </>
        )}

        {/* Ownership */}
        {ownerRows.length > 0 && (
          <>
            <SectionHeader title="Dados de Propriedade" />
            <DataTable rows={ownerRows} />
          </>
        )}

        {/* Photos */}
        {(property.photos || []).filter(url => !/\.(mp4|mov|webm)(\?|$)/i.test(url)).length > 0 && (
          <>
            <SectionHeader title="Fotos do Imóvel" />
            <div className="grid grid-cols-2 gap-2 mb-3">
              {(property.photos || [])
                .filter(url => !/\.(mp4|mov|webm)(\?|$)/i.test(url))
                .map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt={`Foto ${i + 1}`}
                    className="w-full aspect-[4/3] object-cover rounded border border-border"
                  />
                ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function PropertyReportDialog({ open, onOpenChange, property }: PropertyReportDialogProps) {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [preparedPdfBlob, setPreparedPdfBlob] = useState<Blob | null>(null);
  const isMobile = isMobileBrowser();

  // Reset preview when dialog closes
  useEffect(() => {
    if (!open) {
      setShowPreview(false);
      setPreparedPdfBlob(null);
    }
  }, [open]);

  useEffect(() => {
    setPreparedPdfBlob(null);
  }, [property.id]);

  const buildFileName = () => {
    const addressParts = [property.rua, property.numero, property.apartamento ? `Apto ${property.apartamento}` : '', property.bairro, `${property.cidade}/${property.estado}`].filter(Boolean).join(', ');
    return `Reporte - ${property.tipo_imovel || 'Imóvel'} - ${addressParts}.pdf`.replace(/[/\\:*?"<>|]/g, '-');
  };

  const preparePdfBlob = useCallback(async () => {
    const doc = await generatePropertyPDF(property);
    return doc.output('blob');
  }, [property]);

  const handleDownloadPDF = async () => {
    setGenerating(true);
    try {
      const fileName = buildFileName();

      if (isMobile) {
        if (!preparedPdfBlob) {
          const blob = await preparePdfBlob();
          setPreparedPdfBlob(blob);
          toast.success('PDF pronto. Toque novamente para compartilhar o arquivo.');
          return;
        }

        const deliveryResult = await sharePreparedPdf(preparedPdfBlob, fileName);
        if (deliveryResult === 'cancelled') {
          return;
        }
      } else {
        const blob = preparedPdfBlob ?? await preparePdfBlob();
        const deliveryResult = await deliverPdfBlob(blob, fileName);
        if (deliveryResult === 'cancelled') {
          return;
        }
      }

      toast.success('Relatório PDF gerado com sucesso!');
    } catch (err) {
      logger.error('PDF generation error:', err);
      toast.error('Erro ao gerar PDF');
    } finally {
      setGenerating(false);
    }
  };

  const handleSendEmail = async () => {
    if (!email || !email.includes('@')) {
      toast.error('Informe um email válido');
      return;
    }

    setSending(true);
    try {
      const doc = await generatePropertyPDF(property);
      const pdfBlob = doc.output('blob');
      const fileName = buildFileName();
      const filePath = `reports/${crypto.randomUUID()}_${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('property-documents')
        .upload(filePath, pdfBlob, { contentType: 'application/pdf' });

      if (uploadError) throw uploadError;

      const { data: urlData, error: urlError } = await supabase.storage
        .from('property-documents')
        .createSignedUrl(filePath, 60 * 60 * 24 * 7);

      if (urlError || !urlData?.signedUrl) throw urlError || new Error('URL não gerada');

      const mapImageUrl = property.latitude && property.longitude
        ? `https://staticmap.openstreetmap.de/staticmap.php?center=${property.latitude},${property.longitude}&zoom=15&size=560x300&markers=${property.latitude},${property.longitude},red-pushpin`
        : '';

      const idempotencyKey = `property-report-${property.id}-${Date.now()}`;

      const { error: sendError } = await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'property-report',
          recipientEmail: email,
          idempotencyKey,
          templateData: {
            address: getFullAddress(property),
            neighborhood: property.bairro,
            city: `${property.cidade}/${property.estado}`,
            propertyType: property.tipo_imovel || '',
            status: getStatus(property),
            area: property.metragem ? formatNumber(property.metragem) : '',
            rooms: property.quartos ? String(property.quartos) : '',
            bathrooms: property.banheiros ? String(property.banheiros) : '',
            garages: property.garagens ? String(property.garagens) : '',
            iptu: property.iptu_value ? formatCurrency(property.iptu_value) : '',
            condominium: property.valor_condominio ? formatCurrency(property.valor_condominio) : '',
            rentValue: property.valor_aluguel ? formatCurrency(property.valor_aluguel) : '',
            owner: property.proprietario_matricula || '',
            ownerPercent: property.percentual_proprietario_matricula ? String(property.percentual_proprietario_matricula) : '',
            mapImageUrl,
            downloadUrl: urlData.signedUrl,
          },
        },
      });

      if (sendError) throw sendError;

      toast.success(`Relatório enviado para ${email}!`);
      setEmail('');
      onOpenChange(false);
    } catch (err: unknown) {
      logger.error('Email send error:', err);
      toast.error('Erro ao enviar email.');
    } finally {
      setSending(false);
    }
  };

  const address = getFullAddress(property);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={showPreview ? 'sm:max-w-lg max-h-[90vh] p-0 gap-0' : 'sm:max-w-md'}>
        {showPreview ? (
          <>
            {/* Preview Mode */}
            <div className="flex items-center gap-2 px-4 py-3 border-b">
              <Button variant="ghost" size="sm" onClick={() => setShowPreview(false)} className="h-7 px-2 gap-1">
                <ArrowLeft className="h-3.5 w-3.5" />
                <span className="text-sm">Voltar</span>
              </Button>
              <span className="text-sm font-medium text-muted-foreground flex-1">Pré-visualização do Relatório</span>
            </div>
            <ScrollArea className="flex-1 max-h-[calc(90vh-120px)]">
              <div className="p-4">
                <ReportPreview property={property} />
              </div>
            </ScrollArea>
            <div className="flex gap-2 px-4 py-3 border-t bg-muted/30">
              <Button
                onClick={handleDownloadPDF}
                disabled={generating}
                className="flex-1 gap-2 bg-[hsl(145,30%,18%)] hover:bg-[hsl(145,30%,14%)] text-white"
                size="sm"
              >
                {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                {isMobile ? 'Compartilhar PDF' : 'Baixar PDF'}
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Actions Mode */}
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-[hsl(145,30%,25%)]" />
                Relatório do Imóvel
              </DialogTitle>
              <DialogDescription className="text-sm">
                {address}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Preview button */}
              <Button
                onClick={() => setShowPreview(true)}
                variant="outline"
                className="w-full gap-2 border-primary/30"
              >
                <Eye className="h-4 w-4" />
                Pré-visualizar Relatório
              </Button>

              <Button
                onClick={handleDownloadPDF}
                disabled={generating}
                className="w-full gap-2 bg-[hsl(145,30%,18%)] hover:bg-[hsl(145,30%,14%)] text-white"
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {isMobile ? 'Compartilhar Relatório PDF' : 'Baixar Relatório PDF'}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-sm uppercase">
                  <span className="bg-background px-2 text-muted-foreground">ou enviar por email</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="report-email">Email de destino</Label>
                <div className="flex gap-2">
                  <Input
                    id="report-email"
                    type="email"
                    placeholder="exemplo@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendEmail()}
                  />
                  <Button
                    onClick={handleSendEmail}
                    disabled={sending || !email}
                    variant="outline"
                    className="gap-1.5 border-primary/30 hover:bg-primary/10 shrink-0"
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Enviar
                  </Button>
                </div>
                <p className="text-[13px] text-muted-foreground">
                  O PDF será enviado como link de download válido por 7 dias.
                </p>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
