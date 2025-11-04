/**
 * Calculate booking price based on property, dates, and number of guests
 * @param {Object} property - Property document
 * @param {Date} checkIn - Check-in date
 * @param {Date} checkOut - Check-out date
 * @param {Number} numberOfGuests - Number of guests
 * @returns {Object} Pricing breakdown
 */
const calculateBookingPrice = (property, checkIn, checkOut, numberOfGuests) => {
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));

  const basePrice = property.pricing.basePrice * nights;
  const perHeadCharges = property.pricing.perHeadPrice * numberOfGuests * nights;
  const subtotal = basePrice + perHeadCharges;

  // Calculate discounts
  let discount = 0;
  if (nights >= 30 && property.pricing.discounts.monthly > 0) {
    discount = subtotal * (property.pricing.discounts.monthly / 100);
  } else if (nights >= 7 && property.pricing.discounts.weekly > 0) {
    discount = subtotal * (property.pricing.discounts.weekly / 100);
  }

  // Extra fees
  const cleaningFee = property.pricing.extraFees.cleaningFee || 0;
  const serviceFee = property.pricing.extraFees.serviceFee || 0;
  const otherFees = property.pricing.extraFees.otherFees?.reduce((sum, fee) => sum + fee.amount, 0) || 0;

  const totalAmount = subtotal - discount + cleaningFee + serviceFee + otherFees;
  const advanceAmount = totalAmount * 0.3; // 30% advance
  const remainingAmount = totalAmount - advanceAmount;

  return {
    basePrice: property.pricing.basePrice,
    numberOfNights: nights,
    subtotal,
    perHeadCharges,
    extraFees: {
      cleaningFee,
      serviceFee,
      otherFees: property.pricing.extraFees.otherFees || []
    },
    discounts: discount,
    totalAmount,
    advanceAmount,
    remainingAmount
  };
};

module.exports = calculateBookingPrice;

