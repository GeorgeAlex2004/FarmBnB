/*
  Usage:
    node scripts/setFirebaseAdminClaim.js --uid <FIREBASE_UID>

  Requires env:
    FIREBASE_PROJECT_ID
    FIREBASE_CLIENT_EMAIL
    FIREBASE_PRIVATE_KEY (with \n-escaped newlines)
*/

require('dotenv').config();
const admin = require('firebase-admin');

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return null;
}

const uid = getArg('--uid');

if (!uid) {
  console.error('Missing required --uid <FIREBASE_UID>');
  process.exit(1);
}

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
    const user = await admin.auth().getUser(uid);
    console.log(`Found user: ${user.email || uid}`);

    await admin.auth().setCustomUserClaims(uid, { admin: true, role: 'admin' });
    console.log('Custom claims set: { admin: true, role: "admin" }');

    await admin.auth().revokeRefreshTokens(uid);
    console.log('Revoked refresh tokens to apply new claims.');

    console.log('Done.');
    process.exit(0);
  } catch (err) {
    console.error('Failed to set admin claim:', err.message);
    process.exit(1);
  }
})();


