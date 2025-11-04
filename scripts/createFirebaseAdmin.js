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

function getArg(flag, fallback) {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}

// Set your sole admin's credentials here
const email = 'george.j.alexander77@gmail.com';
const password = 'Tukkibird1!';
const displayName = 'Admin';

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

    console.log('Done. Email:', email);
    process.exit(0);
  } catch (err) {
    console.error('Failed to create admin user:', err.message);
    process.exit(1);
  }
})();


