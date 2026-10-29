// Checks the real Firebase project from .env: anonymous sign-in and published rules.
// Usage: node scripts/check-firebase.mjs   (creates one anonymous user, writes nothing)
import { readFileSync } from 'node:fs';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { get, getDatabase, ref } from 'firebase/database';

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);
const app = initializeApp({
  apiKey: env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  appId: env.EXPO_PUBLIC_FIREBASE_APP_ID,
});

const step = async (name, fn) => {
  try {
    const out = await fn();
    console.log(`OK    ${name}${out ? ` — ${out}` : ''}`);
    return true;
  } catch (e) {
    console.log(`FAIL  ${name} — ${e.code ?? ''} ${e.message}`);
    return false;
  }
};

const db = getDatabase(app);
let ok = await step('anonymous sign-in (Authentication › Anonymous enabled)', async () => {
  const cred = await signInAnonymously(getAuth(app));
  return `uid ${cred.user.uid.slice(0, 6)}…`;
});
if (ok) {
  ok = (await step('read ratings (Word Duel rules published)', async () => {
    const snap = await get(ref(db, 'ratings'));
    return snap.exists() ? `${Object.keys(snap.val()).length} players` : 'empty';
  })) && ok;
  const rootOpen = await get(ref(db, '/')).then(
    () => true,
    () => false,
  );
  console.log(rootOpen ? 'FAIL  root is readable — rules are still the default/test ones' : 'OK    root is locked (rules are not wide open)');
  ok = ok && !rootOpen;
}
console.log(ok ? 'firebase setup looks good' : 'firebase setup needs attention');
process.exit(ok ? 0 : 1);
