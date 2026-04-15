import { useState } from 'react';
import { Property } from '@/types/property';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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

function generatePropertyPDF(property: Property): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // Header bar
  doc.setFillColor(30, 58, 45);
  doc.rect(0, 0, pageWidth, 42, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('My Home Collection', margin, 20);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Relatório Individual de Imóvel', margin, 28);
  doc.setFontSize(8);
  doc.text(
    `Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
    margin, 36
  );

  let yPos = 52;

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
  charData.push(['Tipo de Imóvel', property.tipo_imovel || '-']);
  if (property.metragem) charData.push(['Metragem Privativa', `${formatNumber(property.metragem)} m²`]);
  if (property.area_comum) charData.push(['Área Comum', `${formatNumber(property.area_comum)} m²`]);
  if (property.area_total) charData.push(['Área Total', `${formatNumber(property.area_total)} m²`]);
  charData.push(['Quartos', String(property.quartos || 0)]);
  charData.push(['Suítes', String(property.suites || 0)]);
  charData.push(['Banheiros', String(property.banheiros || 0)]);
  charData.push(['Vagas de Garagem', String(property.garagens || 0)]);
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
  yPos = (doc as any).lastAutoTable.finalY + 8;

  // --- FINANCIAL TABLE ---
  if (yPos > 230) { doc.addPage(); yPos = 18; }
  doc.setFillColor(240, 244, 240);
  doc.roundedRect(margin, yPos, contentWidth, 8, 1, 1, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 45);
  doc.text('INFORMAÇÕES FINANCEIRAS', margin + 3, yPos + 5.5);
  yPos += 12;

  const finData: string[][] = [];
  finData.push(['Valor de Mercado', formatCurrency(property.market_value)]);
  finData.push(['Valor Declarado', formatCurrency(property.declared_value)]);
  if (property.iptu_value) finData.push(['IPTU Anual', formatCurrency(property.iptu_value)]);
  finData.push(['IPTU Pago', property.iptu_pago ? 'Sim' : 'Não']);
  if (property.valor_condominio) finData.push(['Condomínio Mensal', formatCurrency(property.valor_condominio)]);
  if (property.valor_aluguel) finData.push(['Aluguel Mensal', formatCurrency(property.valor_aluguel)]);
  if (property.taxa_administracao) finData.push(['Taxa de Administração', formatCurrency(property.taxa_administracao)]);

  autoTable(doc, {
    startY: yPos,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    theme: 'striped',
    headStyles: { fillColor: [30, 58, 45], fontSize: 8, fontStyle: 'bold', cellPadding: 2 },
    bodyStyles: { fontSize: 8, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: 'bold', textColor: [80, 80, 80], cellWidth: 55 } },
    head: [['Item Financeiro', 'Valor']],
    body: finData,
  });
  yPos = (doc as any).lastAutoTable.finalY + 8;

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
    if (property.proprietario_papel)
      ownerData.push(['Proprietário Papel', property.proprietario_papel]);
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
    yPos = (doc as any).lastAutoTable.finalY + 8;
  }

  // --- OBSERVATIONS ---
  if (property.observacao) {
    if (yPos > 240) { doc.addPage(); yPos = 18; }
    doc.setFillColor(240, 244, 240);
    doc.roundedRect(margin, yPos, contentWidth, 8, 1, 1, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 45);
    doc.text('OBSERVAÇÕES', margin + 3, yPos + 5.5);
    yPos += 12;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 30, 30);
    const obsLines = doc.splitTextToSize(property.observacao, contentWidth);
    doc.text(obsLines, margin, yPos);
  }

  // --- DATES ---
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const pageH = doc.internal.pageSize.getHeight();
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `My Home Collection — Página ${i} de ${totalPages}  |  Criado: ${new Date(property.created_at).toLocaleDateString('pt-BR')}  |  Atualizado: ${new Date(property.updated_at).toLocaleDateString('pt-BR')}`,
      pageWidth / 2, pageH - 6, { align: 'center' }
    );
  }

  return doc;
}

export function PropertyReportDialog({ open, onOpenChange, property }: PropertyReportDialogProps) {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);

  const handleDownloadPDF = () => {
    setGenerating(true);
    try {
      const doc = generatePropertyPDF(property);
      const fileName = `Relatorio_${(property.tipo_imovel || 'Imovel').replace(/\s/g, '_')}_${property.cidade}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
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
      const doc = generatePropertyPDF(property);
      const pdfBlob = doc.output('blob');
      const fileName = `Relatorio_${property.id}.pdf`;
      const filePath = `reports/${crypto.randomUUID()}_${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('property-documents')
        .upload(filePath, pdfBlob, { contentType: 'application/pdf' });

      if (uploadError) throw uploadError;

      const { data: urlData, error: urlError } = await supabase.storage
        .from('property-documents')
        .createSignedUrl(filePath, 60 * 60 * 24 * 7);

      if (urlError || !urlData?.signedUrl) throw urlError || new Error('URL não gerada');

      const { error: sendError } = await supabase.functions.invoke('send-report-email', {
        body: { to: email, downloadUrl: urlData.signedUrl, propertyCount: 1 },
      });

      if (sendError) throw sendError;

      toast.success(`Relatório enviado para ${email}!`);
      setEmail('');
      onOpenChange(false);
    } catch (err: any) {
      logger.error('Email send error:', err);
      toast.error('Erro ao enviar email.');
    } finally {
      setSending(false);
    }
  };

  const address = getFullAddress(property);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-red-700" />
            Relatório do Imóvel
          </DialogTitle>
          <DialogDescription className="text-xs">
            {address}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Button
            onClick={handleDownloadPDF}
            disabled={generating}
            className="w-full gap-2 bg-red-700 hover:bg-red-800"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Baixar Relatório PDF
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase">
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
            <p className="text-[10px] text-muted-foreground">
              O PDF será enviado como link de download válido por 7 dias.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
