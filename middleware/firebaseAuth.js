const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (privateKey && privateKey.includes('\\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
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
      return res.status(401).json({ success: false, message: 'Missing bearer token' });
    }

    const decoded = await admin.auth().verifyIdToken(token);
    req.firebaseUser = decoded; // contains uid, email, and custom claims
    return next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid Firebase token' });
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


