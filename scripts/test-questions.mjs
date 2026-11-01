// Sanity checks for the question generator and word picker: node scripts/test-questions.mjs
import { register } from 'node:module';

// The app imports without extensions (Metro style); teach Node to resolve them.
register(
  'data:text/javascript,' +
    encodeURIComponent(`
export async function resolve(spec, ctx, next) {
  try { return await next(spec, ctx); } catch (e) {
    if (spec.startsWith('.') && !/\\.\\w+$/.test(spec)) return next(spec + '.js', ctx);
    throw e;
  }
}
export async function load(url, ctx, next) {
  if (url.endsWith('.json')) return next(url, { ...ctx, importAttributes: { type: 'json' } });
  return next(url, ctx);
}`),
  import.meta.url,
);

const { buildQuestions } = await import('../src/game/questions.js');
const { pickWords, levelWeights } = await import('../src/game/wordPicker.js');
const { botHistory } = await import('../src/game/bots.js');
const { LEVELS, WORDS, WORDS_BY_LEVEL, getWord, lower, shortMeaning } = await import('../src/data/dictionary.js');

let failures = 0;
const fail = (msg) => {
  failures++;
  if (failures <= 10) console.error('FAIL', msg);
};
const none = () => undefined;
const pct = (n, d) => `${((100 * n) / d).toFixed(1)}%`;

// 1. Every question is well formed.
const types = {};
for (const level of LEVELS) {
  for (let round = 0; round < 150; round++) {
    const qs = buildQuestions({
      count: 10,
      level,
      histories: [none, none],
      firstId: round % 7 === 0 ? WORDS[round * 3].id : undefined,
    });
    if (qs.length !== 10) fail(`${level}: ${qs.length} questions`);
    if (new Set(qs.map((q) => q.word.id)).size !== 10) fail(`${level}: duplicate words`);
    for (const q of qs) {
      types[q.type] = (types[q.type] ?? 0) + 1;
      if (q.options.length !== 4) fail(`${q.word.en}: ${q.options.length} options`);
      if (!q.options.some((o) => o.id === q.word.id)) fail(`${q.word.en}: answer missing`);
      const labels = q.options.map((o) => lower(o.label));
      if (new Set(labels).size !== 4) fail(`${q.word.en}: duplicate labels ${labels.join(', ')}`);
      if (q.type === 'blank' && !q.text.includes('_____')) fail(`${q.word.en}: blank missing`);
      if (q.type === 'reverse' && q.text !== shortMeaning(q.word)) fail(`${q.word.en}: wrong reverse text`);
    }
  }
}
console.log('question types', types);

// 2. Level mix follows the weights: own level most, lower levels falling off, one level up rarely.
for (const level of ['A1', 'A2', 'B2', 'C2']) {
  const counts = Object.fromEntries(LEVELS.map((l) => [l, 0]));
  for (let i = 0; i < 400; i++) pickWords({ count: 10, level, histories: [none] }).forEach((p) => counts[p.word.l]++);
  const total = 4000;
  const own = counts[level] / total;
  if (own < 0.5) fail(`${level}: only ${pct(counts[level], total)} own-level words`);
  const L = LEVELS.indexOf(level);
  if (LEVELS[L + 2] && counts[LEVELS[L + 2]] > 0) fail(`${level}: words two levels up`);
  console.log(`level ${level}:`, LEVELS.map((l) => `${l} ${pct(counts[l], total)}`).join('  '));
}
console.log('weights C2', levelWeights('C2').map((w) => w.toFixed(3)).join(' '));

// 3. Playing many matches in a row: few repeats between consecutive matches.
{
  const history = {};
  const mine = (id) => history[id];
  let prev = new Set();
  let repeats = 0;
  let total = 0;
  for (let m = 0; m < 40; m++) {
    const picked = pickWords({ count: 10, level: 'B1', histories: [mine] });
    const now = Date.now();
    for (const { word } of picked) {
      if (prev.has(word.id)) repeats++;
      total++;
      const right = Math.random() < 0.7;
      const e = history[word.id] ?? { c: 0, w: 0 };
      history[word.id] = { c: e.c + (right ? 1 : 0), w: e.w + (right ? 0 : 1), last: right ? 1 : 0, t: now };
    }
    prev = new Set(picked.map((p) => p.word.id));
  }
  const known = Object.values(history).filter((e) => e.last === 1).length;
  console.log(`back-to-back repeats: ${repeats}/${total} (${pct(repeats, total)}), ${Object.keys(history).length} distinct words, ${known} known`);
  if (repeats / total > 0.08) fail('too many back-to-back repeats');
}

// 4. Two players: words both still have to learn beat everything else.
{
  const B1 = WORDS_BY_LEVEL.B1;
  const shared = new Set(B1.slice(0, 40).map((w) => w.id));
  const knownByBoth = new Set(B1.slice(40, 400).map((w) => w.id));
  const old = Date.now() - 30 * 24 * 3600 * 1000;
  const h = (id) =>
    shared.has(id) ? { c: 0, w: 1, last: 0, t: old } : knownByBoth.has(id) ? { c: 3, w: 0, last: 1, t: old } : undefined;
  let sharedHits = 0;
  let knownHits = 0;
  let n = 0;
  for (let i = 0; i < 300; i++) {
    for (const p of pickWords({ count: 10, level: 'B1', histories: [h, h], reviewIds: [...shared] })) {
      if (p.word.l !== 'B1') continue;
      n++;
      if (shared.has(p.word.id)) sharedHits++;
      if (knownByBoth.has(p.word.id)) knownHits++;
      if (shared.has(p.word.id) && p.reason !== 'shared') fail('shared word without shared reason');
    }
  }
  const sharedBase = shared.size / B1.length;
  const knownBase = knownByBoth.size / B1.length;
  console.log(
    `shared review: ${pct(sharedHits, n)} of B1 picks (pool share ${pct(shared.size, B1.length)}), ` +
      `known-by-both: ${pct(knownHits, n)} (pool share ${pct(knownByBoth.size, B1.length)})`,
  );
  if (sharedHits / n < sharedBase * 3) fail('shared review words not prioritised');
  if (knownHits / n > knownBase * 0.3) fail('words both know are not pushed back');
}

// 5. Bot histories are stable and plausible.
{
  const bot = { name: 'Can Demir', rating: 1300 };
  const h = botHistory(bot, (id) => getWord(id)?.l);
  const again = botHistory(bot, (id) => getWord(id)?.l);
  const sample = WORDS.slice(0, 2000);
  if (sample.some((w) => JSON.stringify(h(w.id)) !== JSON.stringify(again(w.id)))) fail('bot history not deterministic');
  const seen = sample.filter((w) => h(w.id)).length;
  console.log(`bot has seen ${pct(seen, sample.length)} of sample words`);
}

// 6. An opponent whose app lacks some words (older dictionary) still gets playable questions.
{
  const { serializeQuestions, hydrateQuestions } = await import('../src/game/questions.js');
  const { WORD_BY_ID } = await import('../src/data/dictionary.js');
  const qs = buildQuestions({ count: 10, level: 'B1', histories: [() => null, () => null], reviewIds: [] });
  const specs = JSON.parse(JSON.stringify(serializeQuestions(qs)));
  const missing = specs.flatMap((s) => [s.w, ...s.o]).slice(0, 8);
  const saved = missing.map((id) => [id, WORD_BY_ID[id]]);
  for (const id of missing) delete WORD_BY_ID[id];
  const back = hydrateQuestions(specs, () => null);
  back.forEach((q, i) => {
    if (q.word.en !== qs[i].word.en || q.text !== qs[i].text) fail(`hydrate without local word: question ${i}`);
    if (q.options.map((o) => o.label).join('|') !== qs[i].options.map((o) => o.label).join('|')) fail(`hydrate options: question ${i}`);
  });
  if (missing.some((id) => !getWord(id))) fail('remote words not remembered for summary screens');
  for (const [id, w] of saved) WORD_BY_ID[id] = w;
}

console.log(failures ? `${failures} failures` : 'all checks passed');
process.exit(failures ? 1 : 0);
