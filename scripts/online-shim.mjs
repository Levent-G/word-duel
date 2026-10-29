// Stand-in for src/online/firebase.js when the online code runs in Node against the local emulators.
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth';
import { connectDatabaseEmulator, getDatabase } from 'firebase/database';

const app = initializeApp({
  apiKey: 'demo-key',
  projectId: 'demo-wordduel',
  databaseURL: 'http://127.0.0.1:9000?ns=demo-wordduel-default-rtdb',
  appId: 'demo-app',
});
const auth = getAuth(app);
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
const database = getDatabase(app);
connectDatabaseEmulator(database, '127.0.0.1', 9000);

export const onlineConfigured = true;
export const db = () => database;
export const currentUid = () => auth.currentUser?.uid ?? null;
export const currentUser = () => auth.currentUser;
export async function ensureSignedIn() {
  if (!auth.currentUser) await signInAnonymously(auth);
  return auth.currentUser.uid;
}
