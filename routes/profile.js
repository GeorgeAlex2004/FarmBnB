const express = require('express');
const { body, validationResult } = require('express-validator');
const { verifyFirebaseToken } = require('../middleware/firebaseAuth');
const { supabase } = require('../utils/supabase');

const router = express.Router();

// Get current user's profile from Supabase
router.get('/', verifyFirebaseToken, async (req, res) => {
  try {
    const uid = req.firebaseUser.uid;
    const displayName = req.firebaseUser.name || req.firebaseUser.email?.split('@')[0] || 'User';
    
    // Check if Supabase is configured
    if (!supabase) {
      console.error('Supabase client not initialized');
      return res.json({ 
        success: true, 
        data: { 
          id: uid, 
          full_name: displayName, 
          phone: null, 
          phone_verified: false 
        } 
      });
    }
    
    // Try to get existing profile
    let { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle(); // Use maybeSingle() instead of single() to return null if not found
    
    // If profile doesn't exist or table doesn't exist, return empty profile
    if (!data) {
      if (error) {
        console.log('Profile query error:', error.code, error.message);
        // If table doesn't exist (PGRST116) or other error, just return empty profile
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          console.warn('Profiles table does not exist. Please run the migration.');
          return res.json({ 
            success: true, 
            data: { 
              id: uid, 
              full_name: displayName, 
              phone: null, 
              phone_verified: false 
            } 
          });
        }
      }
      
      // Try to create profile if no error or it's a "not found" error
      if (!error || error.code === 'PGRST116') {
        const { data: newData, error: insertError } = await supabase
          .from('profiles')
          .insert({ 
            id: uid, 
            full_name: displayName 
          })
          .select()
          .single();
        
        if (insertError) {
          console.warn('Could not create profile:', insertError.code, insertError.message);
          // Return empty profile anyway
          return res.json({ 
            success: true, 
            data: { 
              id: uid, 
              full_name: displayName, 
              phone: null, 
              phone_verified: false 
            } 
          });
        }
        data = newData;
      }
    }
    
    res.json({ success: true, data: data || { id: uid, full_name: displayName, phone: null, phone_verified: false } });
  } catch (error) {
    console.error('Profile fetch error:', error);
    // Return a fallback profile instead of 500 error
    const uid = req.firebaseUser?.uid || 'unknown';
    const displayName = req.firebaseUser?.name || req.firebaseUser?.email?.split('@')[0] || 'User';
    res.json({ 
      success: true, 
      data: { 
        id: uid, 
        full_name: displayName, 
        phone: null, 
        phone_verified: false 
      } 
    });
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
    const displayName = req.firebaseUser.name || req.firebaseUser.email?.split('@')[0] || 'User';
    
    // Check if profile exists
    let { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', uid)
      .maybeSingle();

    // If profile doesn't exist, create it first
    if (!existingProfile) {
      const { error: insertError } = await supabase
        .from('profiles')
        .insert({ 
          id: uid, 
          full_name: displayName 
        });
      
      if (insertError) {
        console.warn('Could not create profile:', insertError.message);
        // Continue anyway - we'll try to update which might fail
      }
    }

    const update = {};
    if (req.body.full_name !== undefined) update.full_name = req.body.full_name;
    if (req.body.phone !== undefined) update.phone = req.body.phone;
    if (req.body.phone_verified !== undefined) update.phone_verified = req.body.phone_verified;

    const { data, error } = await supabase
      .from('profiles')
      .update(update)
      .eq('id', uid)
      .select('*')
      .maybeSingle();
    
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    
    res.json({ success: true, data: data || { id: uid, ...update } });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ success: false, message: 'Failed to update profile', error: error.message });
  }
});

module.exports = router;


