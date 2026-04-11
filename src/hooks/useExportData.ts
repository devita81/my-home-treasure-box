import { Property } from '@/types/property';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { logger } from '@/lib/logger';

interface ExportColumn {
  key: string;
  label: string;
  format?: (value: any, property: Property) => string;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(value || 0);
};

const formatMetragem = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value || 0) + ' m²';
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

// Default columns for export
const defaultColumns: ExportColumn[] = [
  { key: 'address', label: 'Endereço', format: (_, p) => getFullAddress(p) },
  { key: 'tipo_imovel', label: 'Tipo', format: (v) => v || '-' },
  { key: 'metragem', label: 'Metragem', format: (v) => formatMetragem(v) },
  { key: 'numero_matricula', label: 'Nº Matrícula', format: (v) => v || '-' },
  { key: 'numero_contribuinte', label: 'Nº Contribuinte', format: (v) => v || '-' },
  { key: 'proprietario_papel', label: 'Prop. Papel', format: (v) => v || '-' },
  { key: 'proprietario_matricula', label: 'Prop. Matrícula I', format: (v) => v || '-' },
  { key: 'percentual_proprietario_matricula', label: '% Prop. I', format: (v) => v != null ? `${v}%` : '-' },
  { key: 'proprietario_matricula_ii', label: 'Prop. Matrícula II', format: (v) => v || '-' },
  { key: 'percentual_proprietario_matricula_ii', label: '% Prop. II', format: (v) => v != null && v > 0 ? `${v}%` : '-' },
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
  { key: 'tipo_imovel', label: 'Tipo', format: (v) => v || '-' },
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
            : (property as any)[col.key];
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

  const exportToPDF = (
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
      // Create a printable HTML document
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.error('Popup bloqueado. Permita popups para exportar PDF.');
        return;
      }

      const tableRows = properties.map(property => {
        const cells = columns.map(col => {
          const value = col.key === 'address' 
            ? '' 
            : (property as any)[col.key];
          const formatted = col.format ? col.format(value, property) : String(value || '');
          return `<td style="padding: 8px; border: 1px solid #ddd; font-size: 11px;">${formatted}</td>`;
        }).join('');
        return `<tr>${cells}</tr>`;
      }).join('');

      const headerCells = columns.map(col => 
        `<th style="padding: 8px; border: 1px solid #ddd; background-color: #f5f5f5; font-weight: bold; font-size: 11px; text-align: left;">${col.label}</th>`
      ).join('');

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>${title}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { font-size: 18px; margin-bottom: 5px; }
            h2 { font-size: 14px; color: #666; margin-bottom: 20px; font-weight: normal; }
            table { border-collapse: collapse; width: 100%; }
            @media print {
              body { margin: 10mm; }
              table { page-break-inside: auto; }
              tr { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          ${subtitle ? `<h2>${subtitle}</h2>` : ''}
          <p style="font-size: 12px; color: #666; margin-bottom: 15px;">
            ${properties.length} imóveis • Exportado em ${new Date().toLocaleDateString('pt-BR')}
          </p>
          <table>
            <thead>
              <tr>${headerCells}</tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </body>
        </html>
      `;

      printWindow.document.write(html);
      printWindow.document.close();
      
      // Wait for content to load then trigger print
      printWindow.onload = () => {
        printWindow.print();
      };
      
      toast.success('PDF preparado para impressão');
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
