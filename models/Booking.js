const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  bookingNumber: {
    type: String,
    unique: true,
    required: true
  },
  property: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  checkIn: {
    type: Date,
    required: [true, 'Please provide check-in date']
  },
  checkOut: {
    type: Date,
    required: [true, 'Please provide check-out date']
  },
  numberOfGuests: {
    type: Number,
    required: [true, 'Please specify number of guests'],
    min: [1, 'Must have at least 1 guest']
  },
  pricing: {
    basePrice: Number,
    numberOfNights: Number,
    subtotal: Number,
    perHeadCharges: Number,
    extraFees: {
      cleaningFee: Number,
      serviceFee: Number,
      otherFees: [{
        name: String,
        amount: Number
      }]
    },
    discounts: {
      type: Number,
      default: 0
    },
    totalAmount: {
      type: Number,
      required: true
    },
    advanceAmount: {
      type: Number,
      required: true
    },
    remainingAmount: Number
  },
  payment: {
    status: {
      type: String,
      enum: ['pending', 'partial', 'completed', 'refunded', 'failed'],
      default: 'pending'
    },
    advancePaid: {
      type: Number,
      default: 0
    },
    advancePaidAt: Date,
    paymentMethod: String,
    transactionId: String,
    stripePaymentIntentId: String,
    fullPaymentPaid: {
      type: Number,
      default: 0
    },
    fullPaymentPaidAt: Date
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'completed', 'refunded'],
    default: 'pending'
  },
  cancellation: {
    cancelledAt: Date,
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: String,
    refundAmount: Number,
    refundStatus: {
      type: String,
      enum: ['pending', 'processed', 'failed'],
      default: 'pending'
    }
  },
  specialRequests: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Generate booking number before saving
bookingSchema.pre('save', async function(next) {
  if (!this.bookingNumber) {
    const count = await mongoose.model('Booking').countDocuments();
    this.bookingNumber = `FB${Date.now().toString().slice(-8)}${String(count + 1).padStart(4, '0')}`;
  }
  this.updatedAt = Date.now();
  next();
});

// Calculate remaining amount
bookingSchema.methods.calculateRemaining = function() {
  this.pricing.remainingAmount = this.pricing.totalAmount - this.payment.advancePaid;
  return this.pricing.remainingAmount;
};

// Indexes
bookingSchema.index({ property: 1, checkIn: 1, checkOut: 1 });
bookingSchema.index({ customer: 1 });
bookingSchema.index({ bookingNumber: 1 });
bookingSchema.index({ status: 1 });

module.exports = mongoose.model('Booking', bookingSchema);

