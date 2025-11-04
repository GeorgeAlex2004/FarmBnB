const express = require('express');
const { body, validationResult } = require('express-validator');
const { supabase } = require('../utils/supabase');
const { verifyFirebaseToken, requireAdmin } = require('../middleware/firebaseAuth');

const router = express.Router();

// Helpers
const isAdminFromReq = (req) => req.firebaseUser?.admin === true || req.firebaseUser?.role === 'admin';

// @route   POST /api/payments/create-intent
// @desc    Initialize manual (offline/UPI) payment for advance amount
// @access  Private (customer or admin)
router.post('/create-intent', verifyFirebaseToken, [
  body('bookingId').notEmpty().withMessage('Booking ID is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { bookingId } = req.body;

    // Fetch booking
    const { data: booking, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();
    if (error || !booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Authorization: customer who owns booking or admin
    const isAdmin = isAdminFromReq(req);
    if (!isAdmin && booking.customer_id !== req.firebaseUser.uid) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Require admin approval of ID proofs before payment
    if (booking.verification_status && booking.verification_status !== 'approved') {
      return res.status(400).json({ success: false, message: 'ID proof not approved yet. Please wait for admin approval.' });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Cannot process payment for cancelled booking' });
    }

    // Calculate amount to pay (advance = 30% stored in advance_paid target on create)
    const advanceTarget = Math.round(Number(booking.total_amount || 0) * 0.5 * 100) / 100;
    const alreadyPaid = Number(booking.advance_paid || 0);
    const amountToPay = Math.max(advanceTarget - alreadyPaid, 0);
    if (amountToPay <= 0) {
      return res.status(400).json({ success: false, message: 'Advance payment already completed' });
    }

    // Manual flow: no gateway intent. Return amount and mode.
    await supabase
      .from('bookings')
      .update({ payment_method: 'manual' })
      .eq('id', bookingId);

    return res.json({ success: true, clientSecret: null, amount: amountToPay, mode: 'manual', booking: { id: booking.id } });
  } catch (err) {
    console.error('Create payment intent error:', err);
    return res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// @route   POST /api/payments/confirm
// @desc    Confirm manual payment and update booking
// @access  Private (customer or admin)
router.post('/confirm', verifyFirebaseToken, [
  body('bookingId').notEmpty().withMessage('Booking ID is required'),
  body('paymentIntentId').notEmpty().withMessage('Payment Intent ID is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    const { bookingId, paymentIntentId } = req.body;

    // Fetch booking
    const { data: booking, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();
    if (error || !booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const isAdmin = isAdminFromReq(req);
    if (!isAdmin && booking.customer_id !== req.firebaseUser.uid) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (booking.verification_status && booking.verification_status !== 'approved') {
      return res.status(400).json({ success: false, message: 'ID proof not approved yet. Please wait for admin approval.' });
    }

    // Manual flow: accept optional amount and reference; admins can override
    const amountPaid = Number(req.body.amount || 0);
    const referenceId = (req.body.referenceId || '').toString();
    const newAdvance = Number(booking.advance_paid || 0) + amountPaid;
    const total = Number(booking.total_amount || 0);
    const updates = {
      advance_paid: newAdvance,
      payment_method: 'manual',
    };
    if (referenceId) updates.manual_reference = referenceId; // tolerant extra field (ignored by DB if not present)
    if (booking.status === 'pending' && newAdvance >= Math.round(total * 0.5 * 100) / 100) {
      updates.status = 'confirmed';
    }

    const { data: updated, error: updErr } = await supabase
      .from('bookings')
      .update(updates)
      .eq('id', bookingId)
      .select('*')
      .single();
    if (updErr) throw updErr;

    return res.json({ success: true, message: 'Payment recorded successfully', data: updated });
  } catch (err) {
    console.error('Confirm payment error:', err);
    return res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// @route   GET /api/payments/booking/:id
// @desc    Get payment details for a booking
// @access  Private (customer or admin)
router.get('/booking/:id', verifyFirebaseToken, async (req, res) => {
  try {
    const { data: booking, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (error || !booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    const isAdmin = isAdminFromReq(req);
    if (!isAdmin && booking.customer_id !== req.firebaseUser.uid) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    return res.json({
      success: true,
      data: {
        totalAmount: booking.total_amount,
        advancePaid: booking.advance_paid,
        paymentMethod: booking.payment_method || null,
        stripePaymentIntentId: booking.stripe_payment_intent_id || null,
        status: booking.status,
      },
    });
  } catch (err) {
    console.error('Get payment details error:', err);
    return res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

module.exports = router;

