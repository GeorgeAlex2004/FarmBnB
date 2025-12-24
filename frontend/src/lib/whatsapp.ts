/**
 * Free WhatsApp messaging utilities
 * Uses WhatsApp link generation (100% free, no API required)
 */

export interface BookingNotificationData {
  bookingId: string;
  propertyName: string;
  checkInDate: string;
  checkOutDate: string;
  numGuests: number;
  customerName: string;
  foodPreference: string;
  allergies?: string;
  specialRequests?: string;
  vegGuests?: number;
  nonVegGuests?: number;
}

/**
 * Generate a WhatsApp message link with pre-filled message
 * @param phoneNumber - Caretaker's phone number (with country code, e.g., +919876543210)
 * @param message - Pre-filled message text
 * @returns WhatsApp URL that opens in WhatsApp with the message
 */
export function generateWhatsAppLink(phoneNumber: string, message: string): string {
  // Remove any non-digit characters except +
  const cleanPhone = phoneNumber.replace(/[^\d+]/g, '');
  // Encode message for URL
  const encodedMessage = encodeURIComponent(message);
  // WhatsApp link format: https://wa.me/PHONE?text=MESSAGE
  return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
}

/**
 * Generate notification message for caretaker
 */
export function generateCaretakerMessage(data: BookingNotificationData): string {
  const checkIn = new Date(data.checkInDate).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  const checkOut = new Date(data.checkOutDate).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  let message = `🏡 *Booking Confirmation - ${data.propertyName}*\n\n`;
  message += `📅 *Check-in:* ${checkIn}\n`;
  message += `📅 *Check-out:* ${checkOut}\n\n`;
  message += `👥 *Guests:* ${data.numGuests} ${data.numGuests === 1 ? 'guest' : 'guests'}\n`;
  message += `👤 *Customer:* ${data.customerName}\n\n`;
  message += `🍽️ *Food Preferences:*\n`;
  
  // Format food preference with detailed breakdown
  if (data.foodPreference === 'veg') {
    message += `   • All Vegetarian (${data.numGuests} ${data.numGuests === 1 ? 'guest' : 'guests'})\n`;
  } else if (data.foodPreference === 'non-veg') {
    message += `   • All Non-Vegetarian (${data.numGuests} ${data.numGuests === 1 ? 'guest' : 'guests'})\n`;
  } else if (data.foodPreference === 'both') {
    // Try to get veg/non-veg counts from data or parse from special_requests
    let vegCount = data.vegGuests;
    let nonVegCount = data.nonVegGuests;
    
    // If not provided directly, try to parse from special_requests
    if ((!vegCount || !nonVegCount) && data.specialRequests) {
      const bothMatch = data.specialRequests.match(/Both:\s*(\d+)\s*Veg,\s*(\d+)\s*Non-Veg/i);
      if (bothMatch) {
        vegCount = parseInt(bothMatch[1], 10);
        nonVegCount = parseInt(bothMatch[2], 10);
      }
    }
    
    if (vegCount && nonVegCount) {
      message += `   • Mixed: ${vegCount} Vegetarian, ${nonVegCount} Non-Vegetarian\n`;
      message += `   • Total: ${vegCount + nonVegCount} ${(vegCount + nonVegCount) === 1 ? 'guest' : 'guests'}\n`;
    } else {
      message += `   • Mixed (Vegetarian + Non-Vegetarian)\n`;
      message += `   • Total: ${data.numGuests} ${data.numGuests === 1 ? 'guest' : 'guests'}\n`;
    }
  } else {
    message += `   • ${data.foodPreference || 'Not specified'}\n`;
  }
  
  if (data.allergies) {
    message += `\n⚠️ *Allergies:* ${data.allergies}\n`;
  }
  
  if (data.specialRequests) {
    message += `\n📝 *Special Requests:* ${data.specialRequests}\n`;
  }
  
  message += `\n📋 *Booking ID:* ${data.bookingId}\n`;
  message += `\n_This is an automated notification from FarmBnB._`;
  
  return message;
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      document.body.removeChild(textArea);
      return true;
    } catch (e) {
      document.body.removeChild(textArea);
      return false;
    }
  }
}

