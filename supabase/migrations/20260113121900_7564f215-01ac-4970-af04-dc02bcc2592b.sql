-- Create storage bucket for property documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('property-documents', 'property-documents', false);

-- Create RLS policies for the bucket
CREATE POLICY "Authenticated users can view property documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'property-documents' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can upload property documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'property-documents' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update own property documents or admins"
ON storage.objects FOR UPDATE
USING (bucket_id = 'property-documents' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete own property documents or admins"
ON storage.objects FOR DELETE
USING (bucket_id = 'property-documents' AND auth.role() = 'authenticated');

-- Create table for property documents metadata
CREATE TABLE public.property_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  document_type TEXT DEFAULT 'matricula',
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.property_documents ENABLE ROW LEVEL SECURITY;

-- RLS policies for property_documents
CREATE POLICY "Authenticated users can view property documents"
ON public.property_documents
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert property documents"
ON public.property_documents
FOR INSERT
WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Users can delete own documents or admins"
ON public.property_documents
FOR DELETE
USING (auth.uid() = uploaded_by OR has_role(auth.uid(), 'admin'::app_role));