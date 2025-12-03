-- Create social connections table for storing OAuth tokens
CREATE TABLE public.social_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('linkedin', 'facebook', 'instagram', 'twitter')),
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  platform_user_id TEXT,
  platform_username TEXT,
  page_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, platform)
);

-- Enable RLS
ALTER TABLE public.social_connections ENABLE ROW LEVEL SECURITY;

-- Users can only view their own connections
CREATE POLICY "Users can view their own social connections"
ON public.social_connections
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own connections
CREATE POLICY "Users can insert their own social connections"
ON public.social_connections
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own connections
CREATE POLICY "Users can update their own social connections"
ON public.social_connections
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own connections
CREATE POLICY "Users can delete their own social connections"
ON public.social_connections
FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_social_connections_updated_at
BEFORE UPDATE ON public.social_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();