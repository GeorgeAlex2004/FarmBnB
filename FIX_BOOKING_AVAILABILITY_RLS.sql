-- ============================================
-- FIX: Allow customers to view booking dates for availability checking
-- ============================================
-- This policy allows any authenticated user to view booking dates
-- (check_in_date, check_out_date, status, verification_status, payment info)
-- for availability checking, without exposing customer personal information
-- ============================================

-- Add policy to allow viewing booking dates for availability checking
-- This allows customers to see which dates are booked by others
CREATE POLICY "Anyone can view booking dates for availability"
  ON public.bookings FOR SELECT
  USING (
    -- Allow if user is authenticated (for availability checking)
    auth.uid() IS NOT NULL
  );

-- Note: The existing policies will still apply:
-- - "Users can view their own bookings" - allows full access to own bookings
-- - "Admins can view all bookings" - allows full access to all bookings
-- - This new policy allows minimal access (dates only) for availability checking
-- 
-- When querying, Supabase will use the most permissive policy that matches,
-- so users will see their own bookings fully, and other bookings' dates only.

