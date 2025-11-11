import { getApp, getApps, initializeApp } from "firebase/app";
import { Analytics, getAnalytics, isSupported } from "firebase/analytics";

// Firebase config from env (Vite exposes only VITE_* vars)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
} as const;

// Initialize (or reuse) the Firebase app instance
export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Analytics is only available in the browser and when supported (HTTPS, etc.)
export const analyticsPromise: Promise<Analytics | null> = (async () => {
  if (typeof window === "undefined") return null;
  // Skip analytics if required config is missing to avoid noisy 400 warnings
  if (!firebaseConfig.apiKey || !firebaseConfig.measurementId) return null;
  try {
    const supported = await isSupported();
    return supported ? getAnalytics(firebaseApp) : null;
  } catch {
    return null;
  }
})();


