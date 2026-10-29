import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, getReactNativePersistence, initializeAuth, signInAnonymously } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

// Filled from .env (see .env.example). Expo inlines EXPO_PUBLIC_* variables at build time.
const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const onlineConfigured = Boolean(config.apiKey && config.databaseURL && config.projectId && config.appId);

let services = null;

function init() {
  if (services || !onlineConfigured) return services;
  const app = getApps().length ? getApp() : initializeApp(config);
  let auth;
  try {
    auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  } catch {
    auth = getAuth(app);
  }
  services = { app, auth, db: getDatabase(app) };
  return services;
}

export function db() {
  return init()?.db ?? null;
}

let signingIn = null;

/** Anonymous sign-in; the uid survives app restarts. Resolves to the uid, or null when offline is forced. */
export async function ensureSignedIn() {
  const s = init();
  if (!s) return null;
  if (s.auth.currentUser) return s.auth.currentUser.uid;
  signingIn ??= signInAnonymously(s.auth)
    .then((cred) => cred.user.uid)
    .finally(() => {
      signingIn = null;
    });
  return signingIn;
}

export function currentUid() {
  return init()?.auth.currentUser?.uid ?? null;
}

export function currentUser() {
  return init()?.auth.currentUser ?? null;
}
