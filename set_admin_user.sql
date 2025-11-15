-- ============================================
-- SET ADMIN USER
-- Run this after creating your first user account
-- ============================================
-- 
-- Steps:
-- 1. Sign up a user account in your app
-- 2. Go to Supabase Dashboard > Authentication > Users
-- 3. Find your user and copy their UUID (the id field)
-- 4. Replace 'YOUR_USER_UUID_HERE' below with that UUID
-- 5. Run this SQL
-- ============================================

-- Replace 'YOUR_USER_UUID_HERE' with your actual user UUID
INSERT INTO public.user_roles (user_id, role)
VALUES ('0f7c0feb-9e35-4d70-aad9-09f7e78c72e4', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Verify the admin role was added
SELECT 
  ur.id,
  ur.user_id,
  ur.role,
  p.full_name,
  p.phone
FROM public.user_roles ur
LEFT JOIN public.profiles p ON ur.user_id = p.id
WHERE ur.role = 'admin';
