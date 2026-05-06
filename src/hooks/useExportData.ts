import { Property } from '@/types/property';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { logger } from '@/lib/logger';
import { deliverPdfBlob } from '@/lib/pdf-delivery';

interface ExportColumn {
  key: string;
  label: string;
  // value is the raw column value pulled by `(property as Record<string, unknown>)[key]`
  // — could be any of Property's field types. Format functions narrow as needed.
  format?: (value: unknown, property: Property) => string;
}

// Both formatters accept unknown so column 'format' callbacks can pass values
// straight through without local casts. Number(value) || 0 handles
// string/null/undefined/NaN gracefully.
const formatCurrency = (value: unknown) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(Number(value) || 0);
};

const formatMetragem = (value: unknown) => {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value) || 0) + ' m²';
};

const getPropertyAddress = (p: Property) => {
  const parts = [p.rua];
  if (p.numero) parts.push(p.numero);
  if (p.apartamento) parts.push(`Apto ${p.apartamento}`);
  return parts.join(', ');
};

const getFullAddress = (p: Property) => {
  return `${getPropertyAddress(p)} - ${p.bairro}, ${p.cidade}/${p.estado}`;
};

// Stringify-or-dash helper for text cells (preserves '-' on falsy values
// including 0, matching the original 'v || "-"' semantics).
const orDash = (v: unknown): string => (v ? String(v) : '-');

// Default columns for export
const defaultColumns: ExportColumn[] = [
  { key: 'address', label: 'Endereço', format: (_, p) => getFullAddress(p) },
  { key: 'tipo_imovel', label: 'Tipo', format: orDash },
  { key: 'metragem', label: 'Metragem', format: (v) => formatMetragem(v) },
  { key: 'numero_matricula', label: 'Nº Matrícula', format: orDash },
  { key: 'numero_contribuinte', label: 'Nº Contribuinte', format: orDash },
  { key: 'proprietario_papel', label: 'Prop. Papel', format: orDash },
  { key: 'proprietario_matricula', label: 'Prop. Matrícula I', format: orDash },
  { key: 'percentual_proprietario_matricula', label: '% Prop. I', format: (v) => v != null ? `${v}%` : '-' },
  { key: 'proprietario_matricula_ii', label: 'Prop. Matrícula II', format: orDash },
  { key: 'percentual_proprietario_matricula_ii', label: '% Prop. II', format: (v) => v != null && Number(v) > 0 ? `${v}%` : '-' },
  { key: 'declared_value', label: 'Valor Declarado', format: (v) => formatCurrency(v) },
  { key: 'market_value', label: 'Valor de Mercado', format: (v) => formatCurrency(v) },
  { key: 'valor_aluguel', label: 'Aluguel', format: (v) => formatCurrency(v) },
  { key: 'valor_condominio', label: 'Condomínio', format: (v) => formatCurrency(v) },
  { key: 'iptu_value', label: 'IPTU', format: (v) => formatCurrency(v) },
  { key: 'alugado', label: 'Status', format: (v) => v ? 'Alugado' : 'Vago' },
  { key: 'validado', label: 'Validado', format: (v) => v ? 'Sim' : 'Não' },
];

// Simple columns for StatsOverview and MetragemStats
const simpleColumns: ExportColumn[] = [
  { key: 'address', label: 'Endereço', format: (_, p) => getFullAddress(p) },
  { key: 'tipo_imovel', label: 'Tipo', format: orDash },
  { key: 'metragem', label: 'Metragem', format: (v) => formatMetragem(v) },
  { key: 'market_value', label: 'Valor de Mercado', format: (v) => formatCurrency(v) },
  { key: 'declared_value', label: 'Valor Declarado', format: (v) => formatCurrency(v) },
  { key: 'valor_aluguel', label: 'Aluguel', format: (v) => formatCurrency(v) },
];

export function useExportData() {
  const exportToExcel = (
    properties: Property[],
    title: string,
    columns: ExportColumn[] = defaultColumns
  ) => {
    if (properties.length === 0) {
      toast.error('Nenhum dado para exportar');
      return;
    }

    try {
      // Build data array for Excel
      const data = properties.map(property => {
        const row: Record<string, string> = {};
        columns.forEach(col => {
          const value = col.key === 'address'
            ? ''
            : (property as unknown as Record<string, unknown>)[col.key];
          row[col.label] = col.format ? col.format(value, property) : String(value || '');
        });
        return row;
      });

      // Create workbook and worksheet
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      
      // Auto-size columns
      const colWidths = columns.map(col => ({
        wch: Math.max(
          col.label.length,
          ...data.map(row => (row[col.label] || '').length)
        ) + 2
      }));
      worksheet['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Imóveis');

      // Generate filename
      const fileName = `${title.replace(/[^a-zA-Z0-9áéíóúâêîôûãõçÁÉÍÓÚÂÊÎÔÛÃÕÇ ]/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;

      // Write and download
      XLSX.writeFile(workbook, fileName);
      
      toast.success(`Exportado ${properties.length} imóveis para Excel`);
    } catch (error) {
      logger.error('Export error:', error);
      toast.error('Erro ao exportar para Excel');
    }
  };

  const exportToPDF = async (
    properties: Property[],
    title: string,
    subtitle?: string,
    columns: ExportColumn[] = defaultColumns
  ) => {
    if (properties.length === 0) {
      toast.error('Nenhum dado para exportar');
      return;
    }

    try {
      // Generate real PDF using jsPDF
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 10;

      // Title
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(title, margin, 14);

      // Subtitle
      let yPos = 20;
      if (subtitle) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100);
        doc.text(subtitle, margin, yPos);
        yPos += 5;
      }

      // Meta line
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(
        `${properties.length} imóveis • Exportado em ${new Date().toLocaleDateString('pt-BR')}`,
        margin,
        yPos
      );
      doc.setTextColor(0);

      // Build table
      const head = [columns.map((c) => c.label)];
      const body = properties.map((property) =>
        columns.map((col) => {
          const value = col.key === 'address' ? '' : (property as unknown as Record<string, unknown>)[col.key];
          return col.format ? col.format(value, property) : String(value || '');
        })
      );

      autoTable(doc, {
        head,
        body,
        startY: yPos + 4,
        margin: { left: margin, right: margin },
        styles: { fontSize: 7, cellPadding: 1.5, overflow: 'linebreak' },
        headStyles: { fillColor: [240, 240, 240], textColor: 20, fontStyle: 'bold' },
        tableWidth: pageWidth - margin * 2,
      });

      // Filename
      const fileName = `${title.replace(/[^a-zA-Z0-9áéíóúâêîôûãõçÁÉÍÓÚÂÊÎÔÛÃÕÇ ]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;

      const blob = doc.output('blob');
      const deliveryResult = await deliverPdfBlob(blob, fileName);

      if (deliveryResult === 'cancelled') {
        return;
      }

      toast.success(`Exportado ${properties.length} imóveis para PDF`);
    } catch (error) {
      logger.error('PDF export error:', error);
      toast.error('Erro ao exportar para PDF');
    }
  };

  return {
    exportToExcel,
    exportToPDF,
    defaultColumns,
    simpleColumns,
  };
}
