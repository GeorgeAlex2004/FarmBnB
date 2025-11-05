/*
  Usage:
    node scripts/createFirebaseAdmin.js --email admin@farmbnb.com --password StrongPass123 --name "Admin User"

  Requires env:
    FIREBASE_PROJECT_ID
    FIREBASE_CLIENT_EMAIL
    FIREBASE_PRIVATE_KEY (with \n-escaped newlines)
*/

require('dotenv').config();
const admin = require('firebase-admin');
const { supabase } = require('../utils/supabase');

function getArg(flag, fallback) {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}

// Get credentials from command line arguments or use defaults
const email = getArg('--email', 'george.j.alexander77@gmail.com');
const password = getArg('--password', 'Tukkibird1!');
const displayName = getArg('--name', 'Admin');

if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
  console.error('Missing Firebase Admin credentials in environment.');
  process.exit(1);
}

let privateKey = process.env.FIREBASE_PRIVATE_KEY;
if (privateKey.includes('\\n')) privateKey = privateKey.replace(/\\n/g, '\n');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  });
}

(async () => {
  try {
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(email);
      console.log(`User exists: ${email}`);
      // Ensure password and name are updated
      await admin.auth().updateUser(userRecord.uid, { password, displayName, emailVerified: true, disabled: false });
      console.log('Updated existing user password/display name.');
    } catch (_) {
      userRecord = await admin.auth().createUser({ email, password, displayName, emailVerified: true, disabled: false });
      console.log(`Created user: ${email}`);
    }

    // Set custom claims on this user
    await admin.auth().setCustomUserClaims(userRecord.uid, { admin: true, role: 'admin' });
    console.log(`Set custom claims on UID ${userRecord.uid}: { admin: true, role: "admin" }`);

    // Force token refresh on next sign-in
    await admin.auth().revokeRefreshTokens(userRecord.uid);
    console.log('Revoked refresh tokens to apply new claims.');

    // Create/update Supabase profile
    if (supabase) {
      try {
        // Check if profile exists
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', userRecord.uid)
          .single();

        if (existingProfile) {
          // Update existing profile
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ full_name: displayName })
            .eq('id', userRecord.uid);
          
          if (updateError) throw updateError;
          console.log('Updated Supabase profile.');
        } else {
          // Create new profile
          const { error: insertError } = await supabase
            .from('profiles')
            .insert({ id: userRecord.uid, full_name: displayName });
          
          if (insertError) throw insertError;
          console.log('Created Supabase profile.');
        }

        // Set admin role in user_roles table
        // First, check if role exists
        const { data: existingRole } = await supabase
          .from('user_roles')
          .select('*')
          .eq('user_id', userRecord.uid)
          .eq('role', 'admin')
          .single();

        if (!existingRole) {
          // Delete customer role if exists
          await supabase
            .from('user_roles')
            .delete()
            .eq('user_id', userRecord.uid)
            .eq('role', 'customer');

          // Insert admin role
          const { error: roleError } = await supabase
            .from('user_roles')
            .insert({ user_id: userRecord.uid, role: 'admin' });
          
          if (roleError) throw roleError;
          console.log('Set admin role in Supabase user_roles.');
        } else {
          console.log('Admin role already exists in Supabase.');
        }
      } catch (supabaseError) {
        console.warn('Warning: Could not update Supabase profile/role:', supabaseError.message);
        console.warn('Firebase admin user was created successfully, but Supabase update failed.');
      }
    } else {
      console.warn('Warning: Supabase not configured. Skipping Supabase profile/role update.');
    }

    console.log('Done. Email:', email);
    process.exit(0);
  } catch (err) {
    console.error('Failed to create admin user:', err.message);
    process.exit(1);
  }
})();


