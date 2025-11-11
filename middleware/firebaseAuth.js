const admin = require('firebase-admin');

// Detect config
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const FIREBASE_CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL;
let FIREBASE_PRIVATE_KEY = process.env.FIREBASE_PRIVATE_KEY;

if (FIREBASE_PRIVATE_KEY && FIREBASE_PRIVATE_KEY.includes('\\n')) {
  FIREBASE_PRIVATE_KEY = FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
}

const isFirebaseConfigured = Boolean(FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY);

// Initialize Firebase Admin only when fully configured
if (isFirebaseConfigured && !admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      privateKey: FIREBASE_PRIVATE_KEY,
    }),
  });
}

// Verify Firebase ID token from Authorization: Bearer <token>
exports.verifyFirebaseToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    const parts = authHeader.split(' ');
    const token = parts.length === 2 && parts[0] === 'Bearer' ? parts[1] : null;

    if (!token) {
      console.log('Missing token - Authorization header:', authHeader ? 'present' : 'missing');
      return res.status(401).json({ success: false, message: 'Missing bearer token' });
    }

    // Check if Firebase Admin is configured
    if (!isFirebaseConfigured || !admin.apps.length) {
      console.error('Firebase Admin not configured');
      return res.status(503).json({ success: false, message: 'Service unavailable: Firebase Admin is not configured on the server.' });
    }

    const decoded = await admin.auth().verifyIdToken(token);
    req.firebaseUser = decoded; // contains uid, email, and custom claims
    return next();
  } catch (err) {
    console.error('Token verification error:', err.message);
    return res.status(401).json({ success: false, message: 'Invalid Firebase token', error: err.message });
  }
};

// Require admin based on custom claims { admin: true } or role === 'admin'
exports.requireAdmin = (req, res, next) => {
  const claims = req.firebaseUser || {};
  if (claims.admin === true || claims.role === 'admin') {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Admin privileges required' });
};


