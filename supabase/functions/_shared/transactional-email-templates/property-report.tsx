import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Img, Hr, Button,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "DVHome"

interface PropertyReportProps {
  address?: string
  neighborhood?: string
  city?: string
  propertyType?: string
  status?: string
  area?: string
  rooms?: string
  bathrooms?: string
  garages?: string
  iptu?: string
  condominium?: string
  rentValue?: string
  owner?: string
  ownerPercent?: string
  mapImageUrl?: string
  downloadUrl?: string
}

const PropertyReportEmail = (props: PropertyReportProps) => {
  const {
    address = 'Endereço do Imóvel',
    neighborhood = '',
    city = '',
    propertyType = '',
    status = '',
    area = '',
    rooms = '',
    bathrooms = '',
    garages = '',
    iptu = '',
    condominium = '',
    rentValue = '',
    owner = '',
    ownerPercent = '',
    mapImageUrl = '',
    downloadUrl = '',
  } = props

  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>Relatório do Imóvel — {address}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Heading style={h1}>{SITE_NAME}</Heading>
            <Text style={headerSub}>Relatório Individual de Imóvel</Text>
          </Section>

          {/* Map Image - First Item */}
          {mapImageUrl ? (
            <Section style={mapSection}>
              <Img
                src={mapImageUrl}
                alt={`Mapa do imóvel - ${address}`}
                width="560"
                style={mapImage}
              />
            </Section>
          ) : null}

          {/* Address */}
          <Section style={addressSection}>
            <Heading style={h2}>{address}</Heading>
            <Text style={subtitle}>
              {[neighborhood, city].filter(Boolean).join(' — ')}
            </Text>
          </Section>

          <Hr style={divider} />

          {/* Property Info Grid */}
          <Section style={infoSection}>
            <Text style={sectionTitle}>Informações do Imóvel</Text>
            
            {propertyType ? <Text style={infoRow}><span style={label}>Tipo:</span> {propertyType}</Text> : null}
            {status ? <Text style={infoRow}><span style={label}>Status:</span> {status}</Text> : null}
            {area ? <Text style={infoRow}><span style={label}>Área:</span> {area} m²</Text> : null}
            {rooms ? <Text style={infoRow}><span style={label}>Quartos:</span> {rooms}</Text> : null}
            {bathrooms ? <Text style={infoRow}><span style={label}>Banheiros:</span> {bathrooms}</Text> : null}
            {garages ? <Text style={infoRow}><span style={label}>Garagens:</span> {garages}</Text> : null}
          </Section>

          <Hr style={divider} />

          {/* Financial */}
          <Section style={infoSection}>
            <Text style={sectionTitle}>Custos e Receitas</Text>
            {iptu ? <Text style={infoRow}><span style={label}>IPTU:</span> {iptu}</Text> : null}
            {condominium ? <Text style={infoRow}><span style={label}>Condomínio:</span> {condominium}</Text> : null}
            {rentValue ? <Text style={infoRow}><span style={label}>Aluguel:</span> {rentValue}</Text> : null}
          </Section>

          <Hr style={divider} />

          {/* Ownership */}
          {owner ? (
            <Section style={infoSection}>
              <Text style={sectionTitle}>Proprietário</Text>
              <Text style={infoRow}>
                {owner}{ownerPercent ? ` (${ownerPercent}%)` : ''}
              </Text>
            </Section>
          ) : null}

          {/* Download Button */}
          {downloadUrl ? (
            <Section style={ctaSection}>
              <Button style={ctaButton} href={downloadUrl}>
                Baixar Relatório PDF
              </Button>
            </Section>
          ) : null}

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              Este email foi enviado por {SITE_NAME}.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: PropertyReportEmail,
  subject: (data: Record<string, any>) => `Relatório do Imóvel — ${data.address || 'Imóvel'}`,
  displayName: 'Relatório de Imóvel',
  previewData: {
    address: 'Rua das Flores, 123',
    neighborhood: 'Jardim Europa',
    city: 'São Paulo/SP',
    propertyType: 'Apartamento',
    status: 'Alugado',
    area: '120',
    rooms: '3',
    bathrooms: '2',
    garages: '2',
    iptu: 'R$ 3.500,00',
    condominium: 'R$ 1.200,00',
    rentValue: 'R$ 5.000,00',
    owner: 'João Silva',
    ownerPercent: '100',
    mapImageUrl: 'https://tile.openstreetmap.org/15/10881/14973.png',
    downloadUrl: 'https://example.com/report.pdf',
  },
} satisfies TemplateEntry

// Styles
const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { maxWidth: '600px', margin: '0 auto', padding: '0' }
const header = { backgroundColor: '#2d5a3d', padding: '24px 30px', textAlign: 'center' as const }
const h1 = { color: '#ffffff', fontSize: '22px', fontWeight: '700', margin: '0', letterSpacing: '1px' }
const headerSub = { color: '#c8ddd0', fontSize: '13px', margin: '6px 0 0', fontWeight: '400' }
const mapSection = { padding: '0' }
const mapImage = { width: '100%', height: 'auto', display: 'block' as const }
const addressSection = { padding: '24px 30px 8px' }
const h2 = { fontSize: '18px', fontWeight: '600', color: '#1a1a1a', margin: '0 0 4px' }
const subtitle = { fontSize: '13px', color: '#666666', margin: '0' }
const divider = { borderColor: '#e8e8e8', margin: '0 30px' }
const infoSection = { padding: '16px 30px' }
const sectionTitle = { fontSize: '14px', fontWeight: '600', color: '#2d5a3d', margin: '0 0 10px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }
const infoRow = { fontSize: '14px', color: '#333333', margin: '0 0 6px', lineHeight: '1.5' }
const label = { fontWeight: '600', color: '#555555' }
const ctaSection = { padding: '20px 30px', textAlign: 'center' as const }
const ctaButton = { backgroundColor: '#2d5a3d', color: '#ffffff', padding: '12px 28px', fontSize: '14px', fontWeight: '600', borderRadius: '6px', textDecoration: 'none' }
const footer = { padding: '20px 30px', backgroundColor: '#f5f5f5' }
const footerText = { fontSize: '12px', color: '#999999', margin: '0', textAlign: 'center' as const }
