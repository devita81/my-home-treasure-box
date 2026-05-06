/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

// Templates are stored loosely-typed because each component has its own
// specific props shape (PropertyReportProps, etc). Each template casts at
// its export site (see property-report.tsx).
export type TemplateData = Record<string, unknown>

export interface TemplateEntry {
  component: React.ComponentType<TemplateData>
  subject: string | ((data: TemplateData) => string)
  to?: string
  displayName?: string
  previewData?: TemplateData
}

import { template as propertyReport } from './property-report.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'property-report': propertyReport,
}
