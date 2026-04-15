import { Button } from '@/components/ui/button';

interface ExportButtonsProps {
  onExportExcel: () => void;
  onExportPDF: () => void;
  className?: string;
}

const ExcelIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="#217346" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="#217346" fillOpacity="0.1"/>
    <path d="M14 2V8H20" stroke="#217346" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M8 13L10 17" stroke="#217346" strokeWidth="1.8" strokeLinecap="round"/>
    <path d="M12 13L10 17" stroke="#217346" strokeWidth="1.8" strokeLinecap="round"/>
    <path d="M8 17L10 13" stroke="#217346" strokeWidth="0" />
  </svg>
);

const PdfIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="#B30B00" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="#B30B00" fillOpacity="0.1"/>
    <path d="M14 2V8H20" stroke="#B30B00" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <text x="7" y="17.5" fill="#B30B00" fontSize="6" fontWeight="bold" fontFamily="Arial, sans-serif">PDF</text>
  </svg>
);

export function ExportButtons({ onExportExcel, onExportPDF, className = '' }: ExportButtonsProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Button
        variant="outline"
        size="sm"
        onClick={onExportExcel}
        className="gap-1.5 bg-background border-green-700/40 hover:bg-green-50 hover:border-green-700/60 shadow-sm"
      >
        <ExcelIcon className="h-4 w-4" />
        <span className="hidden sm:inline font-medium text-green-800">Excel</span>
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={onExportPDF}
        className="gap-1.5 bg-background border-red-700/40 hover:bg-red-50 hover:border-red-700/60 shadow-sm"
      >
        <PdfIcon className="h-4 w-4" />
        <span className="hidden sm:inline font-medium text-red-800">PDF</span>
      </Button>
    </div>
  );
}
