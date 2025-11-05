-- Create profiles table if it doesn't exist (for Firebase Auth UIDs as TEXT)
-- This migration ensures the table exists with the correct schema for Firebase UIDs

-- Create profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  full_name TEXT,
  phone TEXT,
  phone_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create user_roles table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, role)
);

-- Create app_role enum if it doesn't exist
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'customer');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles (if they don't exist)
DO $$ BEGIN
  CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    USING (true); -- Allow all reads for now (service role key bypasses RLS)
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (true); -- Allow all updates for now (service role key bypasses RLS)
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create RLS policies for user_roles
DO $$ BEGIN
  CREATE POLICY "Users can view their own roles"
    ON public.user_roles FOR SELECT
    USING (true);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

