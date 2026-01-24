import { Button } from '@/components/ui/button';
import { FileSpreadsheet, FileText } from 'lucide-react';

interface ExportButtonsProps {
  onExportExcel: () => void;
  onExportPDF: () => void;
  className?: string;
}

export function ExportButtons({ onExportExcel, onExportPDF, className = '' }: ExportButtonsProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Button
        variant="outline"
        size="sm"
        onClick={onExportExcel}
        className="gap-1.5"
      >
        <FileSpreadsheet className="h-4 w-4" />
        <span className="hidden sm:inline">Excel</span>
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={onExportPDF}
        className="gap-1.5"
      >
        <FileText className="h-4 w-4" />
        <span className="hidden sm:inline">PDF</span>
      </Button>
    </div>
  );
}
