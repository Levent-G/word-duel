// Builds src/data/words.json from the shared word base: Firestore `words` in Firebase project
// davinci-d30bc (schema: Desktop\davinci2\docs\SHARED_WORDS.md). Words are edited in the davinci
// admin panel; run this before a build to pick up the changes.
//
// The service account key stays OUTSIDE the repo and is never committed:
//   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\...\davinci-d30bc-firebase-adminsdk-....json"
//   npm run words           # write src/data/words.json
//   $env:DRY=1; npm run words  # only show what would change
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const out = resolve(root, 'src/data/words.json');
const PROJECT = 'davinci-d30bc';
const APP = 'wordduel'; // apps.wordduel === false hides a word in this app
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const POS = {
  noun: 'isim',
  verb: 'fiil',
  adjective: 'sıfat',
  adverb: 'zarf',
  preposition: 'edat',
  conjunction: 'bağlaç',
  pronoun: 'zamir',
  determiner: 'belirteç',
  interjection: 'ünlem',
  phrase: 'kalıp',
  'phrasal verb': 'deyimsel fiil',
};

const cred = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!cred || !existsSync(cred)) throw new Error('GOOGLE_APPLICATION_CREDENTIALS must point to the service account JSON outside the repo');
if (resolve(cred).startsWith(root)) throw new Error('The service account key must not live inside the repo');
const sa = JSON.parse(readFileSync(cred, 'utf8'));
if (sa.project_id !== PROJECT) throw new Error(`Key belongs to ${sa.project_id}, expected ${PROJECT}`);

const { initializeApp, cert } = await import('firebase-admin/app');
const { getFirestore } = await import('firebase-admin/firestore');
initializeApp({ credential: cert(sa), projectId: PROJECT });
const snap = await getFirestore().collection('words').get();
const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.id.localeCompare(b.id));

// Player histories and online matches refer to word ids, so a word that is already in words.json
// keeps its old id even when Firestore holds it under another one (duplicates, re-created docs).
const before = existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : [];
const oldIdByEn = new Map(before.map((w) => [w.en.toLowerCase(), w.id]));
// Only ids whose old word still exists are reserved; a word renamed in the admin panel keeps its id.
const docWords = new Set(docs.map((d) => String(d.word ?? '').trim().toLowerCase()));
// Dictionary version: words already in words.json keep theirs (missing = 1, the 1.0 app); words new
// in this pull get the next one. Online matches against older apps only use words they have.
const prevDv = new Map(before.map((w) => [w.id, w.dv ?? 1]));
const nextDv = before.reduce((m, w) => Math.max(m, w.dv ?? 1), 1) + 1;
const reserved = new Set(before.filter((w) => docWords.has(w.en.toLowerCase())).map((w) => w.id));

const seen = new Set();
const words = [];
let skipped = 0;
for (const w of docs) {
  const en = String(w.word ?? '').trim();
  const tr = String(w.translation ?? '').trim();
  const key = en.toLowerCase();
  if (!en || !tr || !LEVELS.includes(w.level) || w.apps?.[APP] === false || seen.has(key)) {
    skipped++;
    continue;
  }
  seen.add(key);
  const ex = w.example ? { en: w.example, tr: w.exampleTr ?? '' } : w.examples?.[0] ?? { en: '', tr: '' };
  // A Firestore id that an older word already uses here gets a prefixed id (kept on later pulls).
  const id = oldIdByEn.get(key) ?? (reserved.has(w.id) ? `fs_${w.id}` : w.id);
  if (!oldIdByEn.has(key) && reserved.has(id)) throw new Error(`Id ${id} (${en}) clashes with an older word`);
  const entry = { id, en, tr, l: w.level, p: POS[w.partOfSpeech] ?? w.partOfSpeech ?? '', e: ex.en, et: ex.tr };
  const dv = prevDv.get(id) ?? nextDv;
  if (dv > 1) entry.dv = dv;
  words.push(entry);
}
if (words.length < 1000) throw new Error(`Only ${words.length} words came back; words.json left untouched`);

const oldById = new Map(before.map((w) => [w.id, w]));
const newIds = new Set(words.map((w) => w.id));
const changed = words.filter((w) => oldById.has(w.id) && JSON.stringify(oldById.get(w.id)) !== JSON.stringify(w)).length;
const added = words.filter((w) => !oldById.has(w.id)).length;
const removed = before.filter((w) => !newIds.has(w.id)).length;
const byLevel = words.reduce((a, w) => ((a[w.l] = (a[w.l] ?? 0) + 1), a), {});
console.log(`${words.length} words (${skipped} skipped) · new ${added} · changed ${changed} · removed ${removed}`, byLevel);
if (process.argv.includes('--dry') || process.env.DRY) console.log('--dry: words.json left untouched');
else writeFileSync(out, JSON.stringify(words));
process.exit(0);
