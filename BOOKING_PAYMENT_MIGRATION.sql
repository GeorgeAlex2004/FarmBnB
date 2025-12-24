-- Migration: Add token payment and guest relations call fields to bookings table
-- Run this migration to update the bookings table schema

-- Add new columns for token payment system
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS token_paid DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'token_pending' 
  CHECK (payment_status IN ('token_pending', 'token_paid', 'full_payment_pending', 'full_payment_completed')),
ADD COLUMN IF NOT EXISTS guest_relations_call_status TEXT DEFAULT 'pending' 
  CHECK (guest_relations_call_status IN ('pending', 'completed')),
ADD COLUMN IF NOT EXISTS guest_relations_call_completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS guest_relations_call_completed_by UUID REFERENCES auth.users(id);

-- Update existing bookings to have proper payment_status
-- If advance_paid > 0, set to appropriate status
-- This runs after the column is added, so it's safe
UPDATE public.bookings
SET payment_status = CASE
  WHEN advance_paid >= total_amount THEN 'full_payment_completed'
  WHEN advance_paid >= 5000 THEN 'full_payment_pending'
  WHEN advance_paid > 0 THEN 'token_paid'
  ELSE 'token_pending'
END
WHERE payment_status = 'token_pending' OR payment_status IS NULL;

-- Set token_paid for existing bookings that have advance_paid >= 5000
UPDATE public.bookings
SET token_paid = 5000
WHERE advance_paid >= 5000 AND token_paid = 0;

-- Create index for faster queries on payment_status
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON public.bookings(payment_status);
CREATE INDEX IF NOT EXISTS idx_bookings_guest_relations_call_status ON public.bookings(guest_relations_call_status);

-- Add comment for documentation
COMMENT ON COLUMN public.bookings.token_paid IS 'Non-refundable token amount (5000 INR) paid at booking';
COMMENT ON COLUMN public.bookings.payment_status IS 'Payment status: token_pending, token_paid, full_payment_pending, full_payment_completed';
COMMENT ON COLUMN public.bookings.guest_relations_call_status IS 'Status of guest relations call: pending or completed';

