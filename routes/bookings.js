const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { supabase } = require('../utils/supabase');
const multer = require('multer');
const path = require('path');
const { verifyFirebaseToken, requireAdmin } = require('../middleware/firebaseAuth');
const admin = require('firebase-admin');

const router = express.Router();
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'images';
const storage = multer.memoryStorage();
const idProofsFilter = (req, file, cb) => {
  const isImage = file.mimetype.startsWith('image/');
  const isPdf = file.mimetype === 'application/pdf';
  if (isImage || isPdf) cb(null, true);
  else cb(new Error('Only image or PDF files are allowed'), false);
};
const uploadIdProofs = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: idProofsFilter });

// Calculate booking pricing
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

// @route   GET /api/bookings
// @desc    Get all bookings (admin sees all, customer sees their own)
// @access  Private
router.get('/', verifyFirebaseToken, async (req, res) => {
  try {
    const {
      status,
      property,
      customer,
      startDate,
      endDate,
      verification,
      page = 1,
      limit = 20
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const from = (pageNum - 1) * limitNum;
    const to = from + limitNum - 1;

    let q = supabase
      .from('bookings')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    const isAdmin = req.firebaseUser?.admin === true || req.firebaseUser?.role === 'admin';
    if (!isAdmin) {
      q = q.eq('customer_id', req.firebaseUser.uid);
    } else {
      if (property) q = q.eq('property_id', property);
      if (customer) q = q.eq('customer_id', customer);
    }
    if (status) q = q.eq('status', status);
    if (verification) q = q.eq('verification_status', verification);
    if (startDate && endDate) {
      const s = new Date(startDate).toISOString();
      const e = new Date(endDate).toISOString();
      q = q.or(`and(check_in_date.gte.${s},check_in_date.lte.${e}),and(check_out_date.gte.${s},check_out_date.lte.${e})`);
    }

    const { data: bookings, count: total, error } = await q;
    if (error) throw error;

    // Enrich with property and customer names
    const propIds = Array.from(new Set((bookings || []).map(b => b.property_id).filter(Boolean)));
    const custIds = Array.from(new Set((bookings || []).map(b => b.customer_id).filter(Boolean)));
    const propMap = new Map();
    const custMap = new Map();
    if (propIds.length) {
      const { data: props } = await supabase.from('properties').select('id,name').in('id', propIds);
      (props || []).forEach(p => propMap.set(p.id, p.name));
    }
    if (custIds.length) {
      const { data: profs } = await supabase.from('profiles').select('id,full_name').in('id', custIds);
      (profs || []).forEach(p => custMap.set(p.id, p.full_name));
    }
    const enriched = (bookings || []).map(b => ({
      ...b,
      property_name: propMap.get(b.property_id) || null,
      customer_name: custMap.get(b.customer_id) || null,
    }));

    res.json({
      success: true,
      count: enriched?.length || 0,
      total: total || 0,
      page: pageNum,
      pages: Math.ceil((total || 0) / limitNum),
      data: enriched
    });
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/bookings/:id
// @desc    Get single booking
// @access  Private
router.get('/:id', verifyFirebaseToken, async (req, res) => {
  try {
    const isAdmin = req.firebaseUser?.admin === true || req.firebaseUser?.role === 'admin';
    let q = supabase.from('bookings').select('*').eq('id', req.params.id);
    if (!isAdmin) q = q.eq('customer_id', req.firebaseUser.uid);
    const { data: booking, error } = await q.single();
    if (error) throw error;

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    res.json({
      success: true,
      data: booking
    });
  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   POST /api/bookings
// @desc    Create new booking
// @access  Private (Customer)
router.post('/', verifyFirebaseToken, [
  body('property').notEmpty().withMessage('Property ID is required'),
  body('checkIn').isISO8601().withMessage('Valid check-in date is required'),
  body('checkOut').isISO8601().withMessage('Valid check-out date is required'),
  body('numberOfGuests').isInt({ min: 1 }).withMessage('Number of guests must be at least 1'),
  body('foodRequired').optional().isBoolean(),
  body('foodPreference').optional().isIn(['veg','non-veg','both']),
  body('allergies').optional().isString(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    // Check if phone number is provided (either verified via Firebase or saved in profile)
    // Note: Firebase phone verification requires billing, so we allow manual verification
    try {
      const firebaseUser = await admin.auth().getUser(req.firebaseUser.uid);
      const hasFirebasePhone = firebaseUser.phoneNumber && firebaseUser.phoneNumber.length > 0;
      
      // Check profiles table for phone number or phone_verified flag
      const { data: profile } = await supabase.from('profiles').select('phone, phone_verified').eq('id', req.firebaseUser.uid).maybeSingle();
      const hasPhoneInProfile = profile && profile.phone && profile.phone.length > 0;
      const isPhoneVerified = hasFirebasePhone || (profile && profile.phone_verified === true);
      
      // Allow booking if phone number exists (even if not Firebase-verified)
      // Admin can verify manually later
      if (!hasFirebasePhone && !hasPhoneInProfile) {
        return res.status(403).json({
          success: false,
          message: 'Phone number required. Please add your phone number in your profile before making a booking.'
        });
      }
    } catch (err) {
      console.error('Error checking phone verification:', err);
      // Don't block booking if we can't check - allow it through
      console.warn('Could not verify phone status, allowing booking anyway');
    }

    const { property: propertyId, checkIn, checkOut, numberOfGuests, specialRequests, foodRequired, foodPreference, allergies } = req.body;

    // Get property
    const { data: property, error: propErr } = await supabase.from('properties').select('*').eq('id', propertyId).single();
    if (propErr) throw propErr;
    if (!property || property.is_active !== true) {
      return res.status(400).json({
        success: false,
        message: 'Property is not available for booking'
      });
    }

    // Check guest capacity
    if (numberOfGuests > (property.max_guests || 1)) {
      return res.status(400).json({
        success: false,
        message: `Maximum ${property.max_guests} guests allowed`
      });
    }

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    // Validate dates
    // No overnight stays: require same-day check-in and check-out. Time-of-day is fixed by policy.
    const sameDay = checkInDate.toDateString() === checkOutDate.toDateString();
    if (!sameDay) {
      return res.status(400).json({
        success: false,
        message: 'Same-day bookings only.'
      });
    }

    if (checkInDate < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Check-in date cannot be in the past'
      });
    }

    // Check availability
    const { data: conflicts, error: conflictErr } = await supabase
      .from('bookings')
      .select('id')
      .eq('property_id', propertyId)
      .in('status', ['pending', 'confirmed'])
      .lte('check_in_date', checkOutDate.toISOString())
      .gte('check_out_date', checkInDate.toISOString())
      .limit(1);
    if (conflictErr) throw conflictErr;
    if (conflicts && conflicts.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Property is already booked for these dates'
      });
    }

    // Calculate pricing
    const perHead = Number(property.per_head_charge || 0);
    const base = Number(property.base_price_per_night || 0);
    const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
    const subtotal = base * nights;
    const guestCharges = perHead * numberOfGuests * nights;
    const foodCharge = (req.body.foodRequired ? (numberOfGuests * 500 * nights) : 0);
    const totalAmount = subtotal + guestCharges + foodCharge + Number(property.cleaning_fee || 0) + Number(property.service_fee || 0);
    // Note: advance_paid should be 0 initially - only updated when payment is actually made

    // Create booking
    const { data: booking, error } = await supabase
      .from('bookings')
      .insert({
        property_id: propertyId,
        customer_id: req.firebaseUser.uid,
        check_in_date: checkInDate.toISOString().slice(0,10),
        check_out_date: checkOutDate.toISOString().slice(0,10),
        num_guests: numberOfGuests,
        base_amount: subtotal,
        guest_charges: guestCharges,
        extra_fees: Number(property.cleaning_fee || 0) + Number(property.service_fee || 0) + foodCharge,
        total_amount: totalAmount,
        advance_paid: 0, // No payment made yet - will be updated when user submits payment
        status: 'pending',
        food_required: !!foodRequired,
        food_preference: foodPreference || null,
        allergies: allergies || null,
        special_requests: specialRequests || null,
      })
      .select('*')
      .single();
    if (error) throw error;

    res.status(201).json({
      success: true,
      data: booking
    });
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   PUT /api/bookings/:id/confirm
// @desc    Confirm booking (admin only)
// @access  Private (Admin)
router.put('/:id/confirm', verifyFirebaseToken, requireAdmin, async (req, res) => {
  try {
    const { data: booking, error } = await supabase.from('bookings').select('*').eq('id', req.params.id).single();
    if (error || !booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }
    if (booking.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Booking is not in pending status'
      });
    }
    const { data: updated, error: updErr } = await supabase
      .from('bookings')
      .update({ status: 'confirmed' })
      .eq('id', req.params.id)
      .select('*')
      .single();
    if (updErr) throw updErr;

    res.json({
      success: true,
      data: updated
    });
  } catch (error) {
    console.error('Confirm booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   PUT /api/bookings/:id/cancel
// @desc    Cancel booking
// @access  Private
router.put('/:id/cancel', verifyFirebaseToken, [
  body('reason').optional().trim(),
], async (req, res) => {
  try {
    const { data: booking, error } = await supabase.from('bookings').select('*').eq('id', req.params.id).single();
    if (error || !booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }
    const isAdmin = req.firebaseUser?.admin === true || req.firebaseUser?.role === 'admin';
    if (!isAdmin && booking.customer_id !== req.firebaseUser.uid) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this booking'
      });
    }

    if (booking.status === 'cancelled' || booking.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Booking cannot be cancelled'
      });
    }

    const { data: updated, error: updErr } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', req.params.id)
      .select('*')
      .single();
    if (updErr) throw updErr;

    res.json({
      success: true,
      data: updated
    });
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   PUT /api/bookings/:id/complete
// @desc    Mark booking as completed (admin only)
// @access  Private (Admin)
router.put('/:id/complete', verifyFirebaseToken, requireAdmin, async (req, res) => {
  try {
    const { data: booking, error } = await supabase.from('bookings').select('*').eq('id', req.params.id).single();
    if (error || !booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }
    if (booking.status !== 'confirmed') {
      return res.status(400).json({
        success: false,
        message: 'Only confirmed bookings can be marked as completed'
      });
    }
    const { data: updated, error: updErr } = await supabase
      .from('bookings')
      .update({ status: 'completed' })
      .eq('id', req.params.id)
      .select('*')
      .single();
    if (updErr) throw updErr;

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Complete booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   POST /api/bookings/:id/id-proofs
// @desc    Upload ID proofs for a booking (customer or admin). Requires at least 2 files.
// @access  Private
router.post('/:id/id-proofs', verifyFirebaseToken, uploadIdProofs.array('files', 10), async (req, res) => {
  try {
    const bookingId = req.params.id;
    const files = req.files || [];
    if (files.length < 2) {
      return res.status(400).json({ success: false, message: 'Please upload at least 2 ID proofs' });
    }

    // Fetch booking and verify ownership/admin
    const { data: booking, error } = await supabase.from('bookings').select('*').eq('id', bookingId).single();
    if (error || !booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    const isAdmin = req.firebaseUser?.admin === true || req.firebaseUser?.role === 'admin';
    if (!isAdmin && booking.customer_id !== req.firebaseUser.uid) {
      return res.status(403).json({ success: false, message: 'Not authorized to upload for this booking' });
    }

    const results = [];
    for (const f of files) {
      const ext = path.extname(f.originalname) || '.bin';
      const uniqueName = `idproof-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      const filePath = `id_proofs/${bookingId}/${uniqueName}`;
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(filePath, f.buffer, { contentType: f.mimetype, upsert: false });
      if (uploadError) return res.status(500).json({ success: false, message: 'Upload failed', error: uploadError.message });
      const { data: publicData } = await supabase.storage.from(BUCKET).getPublicUrl(filePath);
      const publicUrl = publicData?.publicUrl;
      results.push(publicUrl || filePath);
    }

    const newProofs = Array.isArray(booking.id_proofs) ? [...booking.id_proofs, ...results] : results;
    const { data: updated, error: updErr } = await supabase
      .from('bookings')
      .update({ id_proofs: newProofs, verification_status: 'pending' })
      .eq('id', bookingId)
      .select('*')
      .single();
    if (updErr) throw updErr;

    return res.json({ success: true, message: 'ID proofs uploaded', data: updated });
  } catch (err) {
    console.error('Upload ID proofs error:', err);
    return res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// @route   PUT /api/bookings/:id/verify
// @desc    Approve or reject ID proof (admin only)
// @access  Private (Admin)
router.put('/:id/verify', verifyFirebaseToken, requireAdmin, async (req, res) => {
  try {
    const status = (req.body.status || '').toString();
    if (!['approved','rejected','pending'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    const { data: booking, error } = await supabase.from('bookings').select('*').eq('id', req.params.id).single();
    if (error || !booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    const { data: updated, error: updErr } = await supabase
      .from('bookings')
      .update({ verification_status: status })
      .eq('id', req.params.id)
      .select('*')
      .single();
    if (updErr) throw updErr;
    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Verify booking error:', err);
    return res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

module.exports = router;

