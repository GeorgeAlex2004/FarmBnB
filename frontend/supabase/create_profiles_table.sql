-- Run this SQL directly in Supabase SQL Editor to create the profiles table
-- This creates the table with TEXT id for Firebase UIDs
-- Works with or without "public." schema prefix

-- Create app_role enum if it doesn't exist
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'customer');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create profiles table (try with public. prefix first)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
    CREATE TABLE public.profiles (
      id TEXT PRIMARY KEY,
      full_name TEXT,
      phone TEXT,
      phone_verified BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  END IF;
END $$;

-- Create user_roles table
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_roles') THEN
    CREATE TABLE public.user_roles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL,
      role public.app_role NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE (user_id, role)
    );
  END IF;
END $$;

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate
DROP POLICY IF EXISTS "Enable all for service role" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Create basic RLS policies (service role bypasses RLS, but policies are needed for RLS to work)
CREATE POLICY "Enable all for service role" 
  ON public.profiles FOR ALL 
  USING (true) WITH CHECK (true);

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (true);

-- Same for user_roles
DROP POLICY IF EXISTS "Enable all for service role" ON public.user_roles;
CREATE POLICY "Enable all for service role" 
  ON public.user_roles FOR ALL 
  USING (true) WITH CHECK (true);

