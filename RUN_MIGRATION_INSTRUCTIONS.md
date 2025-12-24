# Database Migration Instructions

## ⚠️ IMPORTANT: Run this migration before using the booking system

The booking system requires new database columns that don't exist yet. You **must** run this migration first.

## Quick Steps:

1. **Open Supabase Dashboard**
   - Go to https://app.supabase.com
   - Select your project

2. **Open SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New query" button

3. **Copy and Run Migration**
   - Open `BOOKING_PAYMENT_MIGRATION_SIMPLE.sql` file
   - Copy ALL the SQL content
   - Paste into the SQL Editor
   - Click "Run" button (or press Ctrl+Enter / Cmd+Enter)

4. **Verify Success**
   - You should see "Success. No rows returned" message
   - Go to Table Editor → `bookings` table
   - Check that these new columns exist:
     - `token_paid`
     - `payment_status`
     - `guest_relations_call_status`
     - `guest_relations_call_completed_at`
     - `guest_relations_call_completed_by`

## What This Migration Does:

- Adds `token_paid` column (for ₹5,000 token payment)
- Adds `payment_status` column (tracks payment state)
- Adds guest relations call tracking columns
- Updates existing bookings to have correct payment status
- Creates indexes for better performance

## If You Get Errors:

- Make sure you're running the SQL in the Supabase SQL Editor
- Check that you have admin access to the database
- The migration uses `IF NOT EXISTS` so it's safe to run multiple times

## After Migration:

Once the migration is complete, refresh your frontend and try creating a booking again. The error should be resolved.

