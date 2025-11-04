const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a property name'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Please provide a description']
  },
  location: {
    address: {
      type: String,
      required: [true, 'Please provide an address']
    },
    city: {
      type: String,
      required: true
    },
    state: {
      type: String,
      required: true
    },
    zipCode: {
      type: String,
      required: true
    },
    country: {
      type: String,
      default: 'USA'
    },
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  images: [{
    url: {
      type: String,
      required: true
    },
    filename: String,
    isPrimary: {
      type: Boolean,
      default: false
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  pricing: {
    basePrice: {
      type: Number,
      required: [true, 'Please provide a base price per night'],
      min: [0, 'Price must be positive']
    },
    perHeadPrice: {
      type: Number,
      default: 0,
      min: 0
    },
    extraFees: {
      cleaningFee: {
        type: Number,
        default: 0,
        min: 0
      },
      serviceFee: {
        type: Number,
        default: 0,
        min: 0
      },
      otherFees: [{
        name: String,
        amount: Number
      }]
    },
    discounts: {
      weekly: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
      },
      monthly: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
      }
    }
  },
  capacity: {
    maxGuests: {
      type: Number,
      required: [true, 'Please specify maximum number of guests'],
      min: [1, 'Must accommodate at least 1 guest']
    },
    bedrooms: Number,
    beds: Number,
    bathrooms: Number
  },
  facilities: [{
    name: {
      type: String,
      required: true
    },
    icon: String // Optional icon identifier
  }],
  amenities: {
    wifi: { type: Boolean, default: false },
    parking: { type: Boolean, default: false },
    pool: { type: Boolean, default: false },
    kitchen: { type: Boolean, default: false },
    airConditioning: { type: Boolean, default: false },
    heating: { type: Boolean, default: false },
    petFriendly: { type: Boolean, default: false },
    smokingAllowed: { type: Boolean, default: false },
    tv: { type: Boolean, default: false },
    washingMachine: { type: Boolean, default: false },
    // Add more as needed
  },
  availability: {
    isAvailable: {
      type: Boolean,
      default: true
    },
    blockedDates: [{
      startDate: Date,
      endDate: Date,
      reason: String
    }]
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'draft'],
    default: 'draft'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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

// Update timestamp
propertySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for search
propertySchema.index({ 'location.city': 1, 'location.state': 1 });
propertySchema.index({ status: 1, 'availability.isAvailable': 1 });

module.exports = mongoose.model('Property', propertySchema);

