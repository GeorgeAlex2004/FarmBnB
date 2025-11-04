const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { supabase } = require('../utils/supabase');
const { verifyFirebaseToken, requireAdmin } = require('../middleware/firebaseAuth');

const router = express.Router();

// Helper to normalize facilities to array of plain strings
function normalizeFacilitiesArray(arr) {
  if (!Array.isArray(arr)) return [];
  const seen = new Set();
  const result = [];
  for (const item of arr) {
    let name = null;
    if (typeof item === 'string') {
      const trimmed = item.trim();
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed && typeof parsed === 'object' && parsed.name) name = String(parsed.name);
        } catch (_) {
          name = trimmed;
        }
      } else {
        name = trimmed;
      }
    } else if (item && typeof item === 'object' && item.name) {
      name = String(item.name);
    }
    if (name) {
      const key = name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        result.push(name);
      }
    }
  }
  return result;
}

// @route   GET /api/properties
// @desc    Get all properties (public with filters, admin gets all)
// @access  Public (with optional auth)
router.get('/', async (req, res) => {
  try {
    const {
      city,
      state,
      maxGuests,
      minPrice,
      maxPrice,
      facilities,
      status,
      search,
      page = 1,
      limit = 10
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const from = (pageNum - 1) * limitNum;
    const to = from + limitNum - 1;

    let q = supabase
      .from('properties')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    // Filter by status: 'all' shows everything, 'inactive' shows only inactive, default shows only active
    if (!status || status === 'active') {
      q = q.eq('is_active', true);
    } else if (status === 'inactive') {
      q = q.eq('is_active', false);
    }
    // If status === 'all', don't filter by is_active (show all)
    if (city) q = q.ilike('city', `%${city}%`);
    if (state) q = q.ilike('state', `%${state}%`);
    if (maxGuests) q = q.gte('max_guests', parseInt(maxGuests));
    if (minPrice) q = q.gte('base_price_per_night', parseFloat(minPrice));
    if (maxPrice) q = q.lte('base_price_per_night', parseFloat(maxPrice));
    if (search) q = q.or(`name.ilike.%${search}%,description.ilike.%${search}%,location.ilike.%${search}%`);

    const { data: properties, count: total, error } = await q;
    if (error) throw error;

    // Normalize facilities to plain strings for response
    const normalized = (properties || []).map((p) => ({
      ...p,
      facilities: normalizeFacilitiesArray(p.facilities),
    }));

    res.json({
      success: true,
      count: normalized?.length || 0,
      total: total || 0,
      page: pageNum,
      pages: Math.ceil((total || 0) / limitNum),
      data: normalized
    });
  } catch (error) {
    console.error('Get properties error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// List blackout dates for a property (admin)
router.get('/:id/blackouts', verifyFirebaseToken, requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('property_blackouts')
      .select('*')
      .eq('property_id', req.params.id)
      .order('date', { ascending: true });
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch blackout dates', error: error.message });
  }
});

// Add blackout dates (admin)
router.post('/:id/blackouts', verifyFirebaseToken, requireAdmin, async (req, res) => {
  try {
    const dates = Array.isArray(req.body.dates) ? req.body.dates : [];
    const reason = req.body.reason || null;
    if (!dates.length) return res.status(400).json({ success: false, message: 'No dates provided' });

    const rows = dates.map(d => ({ property_id: req.params.id, date: d, reason }));
    const { data, error } = await supabase
      .from('property_blackouts')
      .upsert(rows, { onConflict: 'property_id,date' })
      .select('*')
      .order('date', { ascending: true });
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to add blackout dates', error: error.message });
  }
});

// Remove blackout dates (admin)
router.delete('/:id/blackouts', verifyFirebaseToken, requireAdmin, async (req, res) => {
  try {
    const dates = Array.isArray(req.body.dates) ? req.body.dates : [];
    if (!dates.length) return res.status(400).json({ success: false, message: 'No dates provided' });
    const { error } = await supabase
      .from('property_blackouts')
      .delete()
      .eq('property_id', req.params.id)
      .in('date', dates);
    if (error) throw error;
    res.json({ success: true, message: 'Removed blackout dates' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to remove blackout dates', error: error.message });
  }
});

// @route   GET /api/properties/:id
// @desc    Get single property by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const { data: property, error } = await supabase
      .from('properties')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;

    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    const blockedDates = [];

    res.json({
      success: true,
      data: { ...property, facilities: normalizeFacilitiesArray(property.facilities), blockedDates }
    });
  } catch (error) {
    console.error('Get property error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   POST /api/properties
// @desc    Create new property
// @access  Private (Admin only)
router.post('/', verifyFirebaseToken, requireAdmin, [
  body('name').trim().notEmpty().withMessage('Property name is required'),
  body('description').notEmpty().withMessage('Description is required'),
  body('location.address').notEmpty().withMessage('Address is required'),
  body('location.city').notEmpty().withMessage('City is required'),
  body('location.state').notEmpty().withMessage('State is required'),
  body('location.zipCode').notEmpty().withMessage('Zip code is required'),
  body('pricing.basePrice').isFloat({ min: 0 }).withMessage('Base price must be a positive number'),
  body('capacity.maxGuests').isInt({ min: 1 }).withMessage('Maximum guests must be at least 1'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    if (!(req.body.googleMapsUrl || req.body.location?.googleMapsUrl)) {
      return res.status(400).json({ success: false, message: 'Google Maps link is required' });
    }

    // Normalize media arrays to plain URL strings
    const normalizedImages = Array.isArray(req.body.images)
      ? req.body.images.map((it) => (typeof it === 'string' ? it : (it?.url || ''))).filter(Boolean)
      : [];
    const normalizedVideos = Array.isArray(req.body.videos)
      ? req.body.videos.map((it) => (typeof it === 'string' ? it : (it?.url || ''))).filter(Boolean)
      : [];

    const payload = {
      name: req.body.name,
      description: req.body.description || null,
      location: req.body.location?.address || req.body.location || null,
      city: req.body.location?.city || null,
      state: req.body.location?.state || null,
      zip_code: req.body.location?.zipCode || null,
      google_maps_url: req.body.googleMapsUrl || req.body.location?.googleMapsUrl || null,
      base_price_per_night: req.body.pricing?.basePrice ?? 0,
      per_head_charge: req.body.pricing?.perHeadPrice ?? 0,
      cleaning_fee: req.body.pricing?.extraFees?.cleaningFee ?? 0,
      service_fee: req.body.pricing?.extraFees?.serviceFee ?? 0,
      max_guests: req.body.capacity?.maxGuests ?? 1,
      images: normalizedImages,
      videos: normalizedVideos,
      facilities: normalizeFacilitiesArray(req.body.facilities),
      is_active: req.body.status ? req.body.status === 'active' : true,
    };

    const { data: property, error } = await supabase
      .from('properties')
      .insert(payload)
      .select('*')
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data: property
    });
  } catch (error) {
    console.error('Create property error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   PUT /api/properties/:id
// @desc    Update property
// @access  Private (Admin only)
router.put('/:id', verifyFirebaseToken, requireAdmin, async (req, res) => {
  try {
    const { data: existing, error: fetchErr } = await supabase.from('properties').select('id').eq('id', req.params.id).single();
    if (fetchErr || !existing) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }
    const update = {};
    if (req.body.name !== undefined) update.name = req.body.name;
    if (req.body.description !== undefined) update.description = req.body.description;
    if (req.body.location?.address !== undefined) update.location = req.body.location.address;
    if (req.body.location?.city !== undefined) update.city = req.body.location.city;
    if (req.body.location?.state !== undefined) update.state = req.body.location.state;
    if (req.body.location?.zipCode !== undefined) update.zip_code = req.body.location.zipCode;
    if (req.body.googleMapsUrl !== undefined || req.body.location?.googleMapsUrl !== undefined) update.google_maps_url = req.body.googleMapsUrl || req.body.location?.googleMapsUrl;
    if (req.body.pricing?.basePrice !== undefined) update.base_price_per_night = req.body.pricing.basePrice;
    if (req.body.pricing?.perHeadPrice !== undefined) update.per_head_charge = req.body.pricing.perHeadPrice;
    if (req.body.pricing?.extraFees?.cleaningFee !== undefined) update.cleaning_fee = req.body.pricing.extraFees.cleaningFee;
    if (req.body.pricing?.extraFees?.serviceFee !== undefined) update.service_fee = req.body.pricing.extraFees.serviceFee;
    if (req.body.capacity?.maxGuests !== undefined) update.max_guests = req.body.capacity.maxGuests;
    if (req.body.images !== undefined) {
      update.images = Array.isArray(req.body.images)
        ? req.body.images.map((it) => (typeof it === 'string' ? it : (it?.url || ''))).filter(Boolean)
        : [];
    }
    if (req.body.videos !== undefined) {
      update.videos = Array.isArray(req.body.videos)
        ? req.body.videos.map((it) => (typeof it === 'string' ? it : (it?.url || ''))).filter(Boolean)
        : [];
    }
    if (req.body.facilities !== undefined) update.facilities = normalizeFacilitiesArray(req.body.facilities);
    if (req.body.status !== undefined) update.is_active = req.body.status === 'active';

    const { data: property, error } = await supabase
      .from('properties')
      .update(update)
      .eq('id', req.params.id)
      .select('*')
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data: property
    });
  } catch (error) {
    console.error('Update property error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   DELETE /api/properties/:id
// @desc    Delete property
// @access  Private (Admin only)
router.delete('/:id', verifyFirebaseToken, requireAdmin, async (req, res) => {
  try {
    const { data: existing, error: fetchErr } = await supabase.from('properties').select('id').eq('id', req.params.id).single();
    if (fetchErr || !existing) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }
    const { error } = await supabase.from('properties').delete().eq('id', req.params.id);
    if (error) throw error;

    res.json({
      success: true,
      message: 'Property deleted successfully'
    });
  } catch (error) {
    console.error('Delete property error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/properties/:id/availability
// @desc    Check property availability for dates
// @access  Public
router.get('/:id/availability', async (req, res) => {
  try {
    const { checkIn, checkOut } = req.query;

    if (!checkIn || !checkOut) {
      return res.status(400).json({
        success: false,
        message: 'Please provide check-in and check-out dates'
      });
    }

    const { data: property, error } = await supabase.from('properties').select('*').eq('id', req.params.id).single();
    if (error) throw error;

    if (!property || property.is_active !== true) {
      return res.json({
        success: true,
        available: false,
        reason: 'Property is not available'
      });
    }

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    // Check for overlapping bookings in Supabase
    const { data: conflicts, error: conflictErr } = await supabase
      .from('bookings')
      .select('id')
      .eq('property_id', req.params.id)
      .in('status', ['confirmed'])
      .lte('check_in_date', checkOutDate.toISOString())
      .gte('check_out_date', checkInDate.toISOString())
      .limit(1);
    if (conflictErr) throw conflictErr;

    // Check blackout dates
    const { data: blackouts, error: blErr } = await supabase
      .from('property_blackouts')
      .select('id')
      .eq('property_id', req.params.id)
      .gte('date', checkInDate.toISOString().slice(0,10))
      .lte('date', checkOutDate.toISOString().slice(0,10))
      .limit(1);
    if (blErr) throw blErr;

    if ((conflicts && conflicts.length > 0) || (blackouts && blackouts.length > 0)) {
      return res.json({
        success: true,
        available: false,
        reason: 'Property is not available for these dates'
      });
    }

    res.json({
      success: true,
      available: true
    });
  } catch (error) {
    console.error('Check availability error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

module.exports = router;

