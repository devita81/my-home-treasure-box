import { useState } from 'react';
import { Property } from '@/types/property';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileText, Send, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PropertyReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  properties: Property[];
}

const formatCurrency = (value: number | null | undefined) => {
  if (!value) return '-';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(value);
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

function generatePDF(properties: Property[]): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // --- COVER / HEADER ---
  doc.setFillColor(30, 58, 45); // dark green
  doc.rect(0, 0, pageWidth, 42, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('My Home Collection', margin, 20);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Relatório de Imóveis', margin, 28);
  doc.setFontSize(8);
  doc.text(
    `Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}  •  ${properties.length} imóveis`,
    margin, 36
  );

  // --- SUMMARY TABLE ---
  let yPos = 52;
  doc.setTextColor(30, 58, 45);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumo Geral', margin, yPos);
  yPos += 6;

  const totalMarket = properties.reduce((s, p) => s + (p.market_value || 0), 0);
  const totalDeclared = properties.reduce((s, p) => s + (p.declared_value || 0), 0);
  const totalRent = properties.reduce((s, p) => s + (p.valor_aluguel || 0), 0);
  const totalArea = properties.reduce((s, p) => s + (p.area_total || 0), 0);
  const rented = properties.filter(p => p.alugado).length;
  const validated = properties.filter(p => p.validado).length;

  autoTable(doc, {
    startY: yPos,
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: { fillColor: [30, 58, 45], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: contentWidth / 3 },
      1: { cellWidth: contentWidth / 3 },
      2: { cellWidth: contentWidth / 3 },
    },
    head: [['Indicador', 'Valor', 'Detalhe']],
    body: [
      ['Total de Imóveis', String(properties.length), `${rented} alugados, ${validated} validados`],
      ['Valor de Mercado Total', formatCurrency(totalMarket), ''],
      ['Valor Declarado Total', formatCurrency(totalDeclared), ''],
      ['Renda Mensal (Aluguéis)', formatCurrency(totalRent), `${rented} imóveis alugados`],
      ['Área Total', `${formatNumber(totalArea)} m²`, ''],
    ],
  });

  // --- PROPERTY DETAILS ---
  yPos = (doc as any).lastAutoTable.finalY + 12;

  properties.forEach((property, index) => {
    // Check page space
    if (yPos > 240) {
      doc.addPage();
      yPos = 18;
    }

    // Property header bar
    doc.setFillColor(240, 244, 240);
    doc.roundedRect(margin, yPos - 4, contentWidth, 10, 1.5, 1.5, 'F');
    doc.setTextColor(30, 58, 45);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`${index + 1}. ${property.tipo_imovel || 'Imóvel'} — ${property.cidade}/${property.estado}`, margin + 3, yPos + 2);

    // Status badge
    const status = getStatus(property);
    const statusColor: [number, number, number] = status === 'Alugado' ? [34, 139, 34] : status === 'Vendido' ? [178, 34, 34] : [100, 100, 100];
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...statusColor);
    const statusWidth = doc.getTextWidth(status) + 4;
    doc.text(status, pageWidth - margin - statusWidth, yPos + 2);
    doc.setTextColor(0, 0, 0);

    yPos += 12;

    // Address
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(80, 80, 80);
    doc.text('Endereço:', margin + 2, yPos);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 30, 30);
    const addressLines = doc.splitTextToSize(getFullAddress(property), contentWidth - 25);
    doc.text(addressLines, margin + 25, yPos);
    yPos += addressLines.length * 4 + 3;

    // Characteristics table
    const charData: string[][] = [];
    if (property.metragem) charData.push(['Metragem Privativa', `${formatNumber(property.metragem)} m²`]);
    if (property.area_comum) charData.push(['Área Comum', `${formatNumber(property.area_comum)} m²`]);
    if (property.area_total) charData.push(['Área Total', `${formatNumber(property.area_total)} m²`]);
    if (property.quartos) charData.push(['Quartos', String(property.quartos)]);
    if (property.suites) charData.push(['Suítes', String(property.suites)]);
    if (property.banheiros) charData.push(['Banheiros', String(property.banheiros)]);
    if (property.garagens) charData.push(['Vagas Garagem', String(property.garagens)]);
    if (property.ano_construcao) charData.push(['Ano Construção', String(property.ano_construcao)]);

    const valData: string[][] = [];
    valData.push(['Valor de Mercado', formatCurrency(property.market_value)]);
    valData.push(['Valor Declarado', formatCurrency(property.declared_value)]);
    if (property.iptu_value) valData.push(['IPTU Anual', formatCurrency(property.iptu_value)]);
    if (property.valor_condominio) valData.push(['Condomínio', formatCurrency(property.valor_condominio)]);
    if (property.valor_aluguel) valData.push(['Aluguel', formatCurrency(property.valor_aluguel)]);
    if (property.taxa_administracao) valData.push(['Taxa Administração', formatCurrency(property.taxa_administracao)]);

    // Two side-by-side tables
    const halfWidth = (contentWidth - 4) / 2;

    if (charData.length > 0) {
      autoTable(doc, {
        startY: yPos,
        margin: { left: margin },
        tableWidth: halfWidth,
        theme: 'striped',
        headStyles: { fillColor: [30, 58, 45], fontSize: 7, fontStyle: 'bold', cellPadding: 1.5 },
        bodyStyles: { fontSize: 7, cellPadding: 1.5 },
        columnStyles: { 0: { fontStyle: 'bold', textColor: [80, 80, 80] } },
        head: [['Característica', 'Valor']],
        body: charData,
      });
    }

    if (valData.length > 0) {
      autoTable(doc, {
        startY: yPos,
        margin: { left: margin + halfWidth + 4 },
        tableWidth: halfWidth,
        theme: 'striped',
        headStyles: { fillColor: [30, 58, 45], fontSize: 7, fontStyle: 'bold', cellPadding: 1.5 },
        bodyStyles: { fontSize: 7, cellPadding: 1.5 },
        columnStyles: { 0: { fontStyle: 'bold', textColor: [80, 80, 80] } },
        head: [['Financeiro', 'Valor']],
        body: valData,
      });
    }

    yPos = (doc as any).lastAutoTable.finalY + 10;

    // Owners
    if (property.proprietario_matricula || property.proprietario_papel) {
      if (yPos > 260) { doc.addPage(); yPos = 18; }
      const ownerData: string[][] = [];
      if (property.proprietario_matricula) {
        ownerData.push(['Prop. Matrícula', `${property.proprietario_matricula} (${property.percentual_proprietario_matricula ?? 100}%)`]);
      }
      if (property.proprietario_matricula_ii) {
        ownerData.push(['Prop. Matrícula II', `${property.proprietario_matricula_ii} (${property.percentual_proprietario_matricula_ii ?? 0}%)`]);
      }
      if (property.proprietario_papel) {
        ownerData.push(['Prop. Papel', property.proprietario_papel]);
      }
      if (property.numero_matricula) {
        ownerData.push(['Nº Matrícula', property.numero_matricula]);
      }
      if (property.numero_contribuinte) {
        ownerData.push(['Nº Contribuinte', property.numero_contribuinte]);
      }
      if (property.inquilino) {
        ownerData.push(['Inquilino', property.inquilino]);
      }

      autoTable(doc, {
        startY: yPos - 6,
        margin: { left: margin },
        tableWidth: contentWidth,
        theme: 'striped',
        headStyles: { fillColor: [100, 120, 100], fontSize: 7, fontStyle: 'bold', cellPadding: 1.5 },
        bodyStyles: { fontSize: 7, cellPadding: 1.5 },
        columnStyles: { 0: { fontStyle: 'bold', textColor: [80, 80, 80], cellWidth: 40 } },
        head: [['Propriedade', 'Informação']],
        body: ownerData,
      });
      yPos = (doc as any).lastAutoTable.finalY + 10;
    }

    // Separator
    if (index < properties.length - 1) {
      if (yPos > 265) { doc.addPage(); yPos = 18; }
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.line(margin, yPos - 4, pageWidth - margin, yPos - 4);
    }
  });

  // Footer on each page
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `My Home Collection — Página ${i} de ${totalPages}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 6,
      { align: 'center' }
    );
  }

  return doc;
}

export function PropertyReportDialog({ open, onOpenChange, properties }: PropertyReportDialogProps) {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);

  const handleDownloadPDF = () => {
    if (properties.length === 0) {
      toast.error('Nenhum imóvel para gerar relatório');
      return;
    }
    setGenerating(true);
    try {
      const doc = generatePDF(properties);
      doc.save(`Relatorio_Imoveis_${new Date().toISOString().split('T')[0]}.pdf`);
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
    if (properties.length === 0) {
      toast.error('Nenhum imóvel para gerar relatório');
      return;
    }

    setSending(true);
    try {
      const doc = generatePDF(properties);
      const pdfBlob = doc.output('blob');
      const fileName = `Relatorio_Imoveis_${new Date().toISOString().split('T')[0]}.pdf`;

      // Upload to storage
      const filePath = `reports/${crypto.randomUUID()}_${fileName}`;
      const { error: uploadError } = await supabase.storage
        .from('property-documents')
        .upload(filePath, pdfBlob, { contentType: 'application/pdf' });

      if (uploadError) throw uploadError;

      // Get signed URL (valid for 7 days)
      const { data: urlData, error: urlError } = await supabase.storage
        .from('property-documents')
        .createSignedUrl(filePath, 60 * 60 * 24 * 7);

      if (urlError || !urlData?.signedUrl) throw urlError || new Error('URL não gerada');

      // Send email via edge function
      const { error: sendError } = await supabase.functions.invoke('send-report-email', {
        body: {
          to: email,
          downloadUrl: urlData.signedUrl,
          propertyCount: properties.length,
        },
      });

      if (sendError) throw sendError;

      toast.success(`Relatório enviado para ${email}!`);
      setEmail('');
      onOpenChange(false);
    } catch (err: any) {
      logger.error('Email send error:', err);
      toast.error('Erro ao enviar email. Verifique as configurações.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-red-700" />
            Relatório de Imóveis
          </DialogTitle>
          <DialogDescription>
            Gere um relatório PDF estruturado com endereço completo, características e valores de {properties.length} imóveis.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Download PDF */}
          <Button
            onClick={handleDownloadPDF}
            disabled={generating || properties.length === 0}
            className="w-full gap-2 bg-red-700 hover:bg-red-800"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Baixar Relatório PDF
          </Button>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">ou enviar por email</span>
            </div>
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Email de destino</Label>
            <div className="flex gap-2">
              <Input
                id="email"
                type="email"
                placeholder="exemplo@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendEmail()}
              />
              <Button
                onClick={handleSendEmail}
                disabled={sending || !email || properties.length === 0}
                variant="outline"
                className="gap-1.5 border-primary/30 hover:bg-primary/10 shrink-0"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Enviar
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              O PDF será enviado como link de download válido por 7 dias.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
