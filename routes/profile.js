const express = require('express');
const { body, validationResult } = require('express-validator');
const { verifyFirebaseToken } = require('../middleware/firebaseAuth');
const { supabase } = require('../utils/supabase');

const router = express.Router();

// Get current user's profile from Supabase
router.get('/', verifyFirebaseToken, async (req, res) => {
  try {
    const uid = req.firebaseUser.uid;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch profile', error: error.message });
  }
});

// Update profile fields in Supabase
router.put('/', verifyFirebaseToken, [
  body('full_name').optional().isString(),
  body('phone').optional().isString(),
  body('phone_verified').optional().isBoolean(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const uid = req.firebaseUser.uid;
    const update = {};
    if (req.body.full_name !== undefined) update.full_name = req.body.full_name;
    if (req.body.phone !== undefined) update.phone = req.body.phone;
    if (req.body.phone_verified !== undefined) update.phone_verified = req.body.phone_verified;

    const { data, error } = await supabase
      .from('profiles')
      .update(update)
      .eq('id', uid)
      .select('*')
      .single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update profile', error: error.message });
  }
});

module.exports = router;


