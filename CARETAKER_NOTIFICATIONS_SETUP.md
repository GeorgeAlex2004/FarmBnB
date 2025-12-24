# Caretaker Notifications Setup Guide

## Overview
This feature automatically generates WhatsApp messages for house caretakers 2 days before a booking's check-in date. The messages include guest details and food preferences.

## Features
- ✅ **100% Free** - Uses WhatsApp link generation (no API costs)
- ✅ **Automatic Detection** - Finds bookings exactly 2 days before check-in
- ✅ **Pre-filled Messages** - Generates formatted messages with all booking details
- ✅ **Copy to Clipboard** - Easy message copying
- ✅ **One-Click WhatsApp** - Opens WhatsApp with pre-filled message

## Setup Instructions

### 1. Add Caretaker Phone Number

You have two options:

#### Option A: Environment Variable (Recommended for single caretaker)
Add to your `.env` file:
```env
VITE_CARETAKER_PHONE=+919980022113
```
**Note:** Include country code (e.g., +91 for India). Current caretaker number: 9980022113

#### Option B: Add to Properties Table (For multiple caretakers)
Add a `caretaker_phone` column to the `properties` table:

```sql
ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS caretaker_phone TEXT;
```

Then set the caretaker phone for each property in the admin panel.

### 2. How It Works

1. **Automatic Detection**: The system checks for confirmed bookings where check-in is exactly 2 days away
2. **Message Generation**: Creates a formatted WhatsApp message with:
   - Property name
   - Check-in and check-out dates
   - Number of guests
   - Customer name
   - Food preferences
   - Allergies (if any)
   - Special requests (if any)
   - Booking ID

3. **Admin Dashboard**: 
   - A notification card appears in the Admin Bookings page
   - Shows all bookings needing notification
   - "Copy Message" button to copy the message text
   - "Open WhatsApp" button to open WhatsApp with pre-filled message

### 3. Using the Feature

1. Navigate to **Admin > Bookings**
2. Look for the **"Caretaker Notifications"** card at the top
3. For each booking:
   - Click **"Copy Message"** to copy the message text
   - Click **"Open WhatsApp"** to open WhatsApp with the message pre-filled
   - Send the message to the caretaker

### 4. Message Format Example

```
🏡 *Booking Confirmation - Farm Stay Property*

📅 *Check-in:* 15 January, 2026
📅 *Check-out:* 17 January, 2026

👥 *Guests:* 4 guests
👤 *Customer:* John Doe

🍽️ *Food Preferences:*
   • Both: 2 Veg, 2 Non-Veg

⚠️ *Allergies:* Peanuts

📝 *Special Requests:* Late check-in requested

📋 *Booking ID:* abc123-def456-ghi789

_This is an automated notification from FarmBnB._
```

### 5. Troubleshooting

**Issue: "Caretaker phone not set" warning**
- Solution: Add `VITE_CARETAKER_PHONE` to your `.env` file or set `caretaker_phone` in the properties table

**Issue: WhatsApp link doesn't open**
- Solution: Make sure the phone number includes country code (e.g., +91 for India)
- Ensure WhatsApp is installed on your device

**Issue: No notifications showing**
- Solution: Check that:
  - Bookings are confirmed
  - Check-in date is exactly 2 days from today
  - Payment status is 'full_payment_completed' or 'full_payment_pending'

## Technical Details

- **Location**: `frontend/src/lib/whatsapp.ts` - WhatsApp utilities
- **API**: `frontend/src/lib/api.ts` - `getBookingsNeedingNotification()` function
- **UI**: `frontend/src/pages/admin/Bookings.tsx` - Notification card component
- **Auto-refresh**: Checks every 60 seconds for new bookings

## Cost
**$0.00** - This solution is completely free:
- No WhatsApp Business API required
- No SMS service needed
- Uses WhatsApp web links (wa.me)
- No subscription fees

## Future Enhancements (Optional)
- Email notifications with WhatsApp link
- Scheduled automatic sending (requires backend/cron)
- Multiple caretaker support per property
- Message templates customization

