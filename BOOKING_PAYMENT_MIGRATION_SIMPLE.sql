-- Simple Migration: Add token payment and guest relations call fields
-- Run this in Supabase SQL Editor

-- Step 1: Add token_paid column
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS token_paid DECIMAL(10,2) DEFAULT 0;

-- Step 2: Add payment_status column
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'token_pending';

-- Step 3: Add check constraint for payment_status
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'bookings_payment_status_check'
  ) THEN
    ALTER TABLE public.bookings
    ADD CONSTRAINT bookings_payment_status_check 
    CHECK (payment_status IN ('token_pending', 'token_paid', 'full_payment_pending', 'full_payment_completed'));
  END IF;
END $$;

-- Step 4: Add guest_relations_call_status column
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS guest_relations_call_status TEXT DEFAULT 'pending';

-- Step 5: Add check constraint for guest_relations_call_status
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'bookings_guest_relations_call_status_check'
  ) THEN
    ALTER TABLE public.bookings
    ADD CONSTRAINT bookings_guest_relations_call_status_check 
    CHECK (guest_relations_call_status IN ('pending', 'completed'));
  END IF;
END $$;

-- Step 6: Add guest_relations_call_completed_at column
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS guest_relations_call_completed_at TIMESTAMP WITH TIME ZONE;

-- Step 7: Add guest_relations_call_completed_by column
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS guest_relations_call_completed_by UUID REFERENCES auth.users(id);

-- Step 8: Update existing bookings
UPDATE public.bookings
SET payment_status = CASE
  WHEN advance_paid >= total_amount THEN 'full_payment_completed'
  WHEN advance_paid >= 5000 THEN 'full_payment_pending'
  WHEN advance_paid > 0 THEN 'token_paid'
  ELSE 'token_pending'
END
WHERE payment_status = 'token_pending';

-- Step 9: Set token_paid for existing bookings
UPDATE public.bookings
SET token_paid = 5000
WHERE advance_paid >= 5000 AND (token_paid = 0 OR token_paid IS NULL);

-- Step 10: Create indexes
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON public.bookings(payment_status);
CREATE INDEX IF NOT EXISTS idx_bookings_guest_relations_call_status ON public.bookings(guest_relations_call_status);

