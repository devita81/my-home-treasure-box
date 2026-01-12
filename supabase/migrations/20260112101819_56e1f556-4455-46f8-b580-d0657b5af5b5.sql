-- Add column to store Street View heading angle per property
ALTER TABLE public.properties 
ADD COLUMN street_view_heading integer DEFAULT 235;