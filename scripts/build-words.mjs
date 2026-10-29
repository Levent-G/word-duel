// Builds src/data/words.json from davinci2's wordDatabase.js.
// Usage: node scripts/build-words.mjs [path/to/wordDatabase.js]
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = process.argv[2] ?? resolve(here, '../../davinci2/src/data/wordDatabase.js');
const out = resolve(here, '../src/data/words.json');

const text = readFileSync(src, 'utf8');
const start = text.indexOf('[', text.indexOf('ALL_WORDS'));
const end = text.indexOf('];', start);
const ALL_WORDS = new Function(`return ${text.slice(start, end + 1)};`)();

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

const seen = new Set();
const words = [];
let skipped = 0;
for (const w of ALL_WORDS) {
  const en = String(w.word ?? '').trim();
  const tr = String(w.translation ?? '').trim();
  const key = en.toLowerCase();
  if (!en || !tr || seen.has(key)) {
    skipped++;
    continue;
  }
  seen.add(key);
  words.push({
    id: w.id,
    en,
    tr,
    l: w.level,
    p: POS[w.partOfSpeech] ?? w.partOfSpeech ?? '',
    e: w.example ?? '',
    et: w.exampleTr ?? '',
  });
}

writeFileSync(out, JSON.stringify(words));
const byLevel = words.reduce((a, w) => ((a[w.l] = (a[w.l] ?? 0) + 1), a), {});
console.log(`${words.length} words written (${skipped} skipped)`, byLevel);
