-- Create storage bucket for property media (photos and videos)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'property-media',
  'property-media',
  true,
  52428800, -- 50MB limit for videos
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'video/mp4', 'video/quicktime', 'video/webm']
);

-- Anyone can view property media (public bucket)
CREATE POLICY "Property media is publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'property-media');

-- Authenticated users can upload to their own folder
CREATE POLICY "Users can upload their own property media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'property-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can update their own media
CREATE POLICY "Users can update their own property media"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'property-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can delete their own media
CREATE POLICY "Users can delete their own property media"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'property-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);