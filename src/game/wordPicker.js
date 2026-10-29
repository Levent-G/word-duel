import { LEVELS, WORDS_BY_LEVEL, getWord } from '../data/dictionary';

/**
 * Word selection for a match.
 *
 * Every player contributes a history lookup `id → { c, w, last, t } | undefined`
 * (c/w = times right/wrong, last = 1 if the latest answer was right, t = when).
 * A word scores highest when it is useful to everyone at the table:
 *   both still have to learn it  >  one has to learn it, the other never saw it
 *   >  nobody saw it  >  useful to one player only  >  everyone already knows it.
 * Recently or often seen words are pushed back so matches do not repeat.
 * Levels: mostly the chosen level, lower levels with falling frequency, the next level up rarely.
 */

const HOUR = 3600 * 1000;
const CANDIDATES_PER_SLOT = 60;
const REVIEW_PER_SLOT = 15;
/** At most this share of a match is review; the rest is new material. */
const MAX_REVIEW_SHARE = 0.4;

/** Share of questions per CEFR level for a player at `level`. */
export function levelWeights(level) {
  const L = LEVELS.indexOf(level);
  return LEVELS.map((_, i) => {
    if (i === L) return 1;
    if (i < L) return 0.38 ** (L - i);
    return i === L + 1 ? 0.12 : 0;
  });
}

function weightedIndex(weights) {
  const total = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

function status(entry) {
  if (!entry) return 'new';
  return entry.last === 0 ? 'learn' : 'known';
}

const PAIR_SCORE = {
  'learn|learn': 6,
  'learn|new': 5,
  'new|new': 4,
  'learn|known': 2.2,
  'new|known': 1.4,
  'known|known': 0.25,
};

function tableScore(statuses) {
  if (statuses.length === 1) return { learn: 5, new: 4, known: 0.3 }[statuses[0]];
  const key = [...statuses].sort((a, b) => order(a) - order(b)).slice(0, 2).join('|');
  return PAIR_SCORE[key];
}

const order = (s) => (s === 'learn' ? 0 : s === 'new' ? 1 : 2);

/** 0…1 multiplier that keeps a word away for a while after anyone saw it. */
function freshness(entry, now) {
  if (!entry || !entry.t) return 1;
  const hours = (now - entry.t) / HOUR;
  const seen = entry.c + entry.w;
  // Wrong answers come back sooner (spaced review), right answers wait longer and longer.
  const halfLife = entry.last === 0 ? 0.25 : 6 * Math.min(seen, 6);
  return 1 - Math.exp(-hours / halfLife);
}

export function wordScore(word, histories, now = Date.now()) {
  const entries = histories.map((h) => h(word.id));
  const base = tableScore(entries.map(status));
  const fresh = Math.min(...entries.map((e) => freshness(e, now)));
  return base * (0.05 + 0.95 * fresh);
}

/** Candidate pool for one slot: random words of the level plus everyone's review words of that level. */
function candidates(levelWords, reviewPool, taken) {
  const out = [];
  for (let i = 0; i < CANDIDATES_PER_SLOT; i++) {
    const w = levelWords[Math.floor(Math.random() * levelWords.length)];
    if (!taken.has(w.id)) out.push(w);
  }
  // A long review list must not crowd out new words, so only a sample of it competes per slot.
  for (let i = 0; i < Math.min(REVIEW_PER_SLOT, reviewPool.length); i++) {
    const w = reviewPool[Math.floor(Math.random() * reviewPool.length)];
    if (!taken.has(w.id)) out.push(w);
  }
  return out;
}

/**
 * @param count      number of words
 * @param level      CEFR level of the (first) player
 * @param histories  one lookup per player at the table
 * @param reviewIds  ids any player has to learn (cheap way to make sure they are considered)
 * @param firstId    word that must open the set (practice from a word page)
 * @returns [{ word, reason }]  reason: 'shared' (everyone's review), 'review' (yours), or null
 */
export function pickWords({ count, level, histories, reviewIds = [], firstId }) {
  const now = Date.now();
  const taken = new Set();
  const picked = [];
  const weights = levelWeights(level);
  const reviewByLevel = {};
  for (const id of reviewIds) {
    const w = getWord(id);
    if (w) (reviewByLevel[w.l] ??= []).push(w);
  }

  const reasonFor = (word) => {
    const st = histories.map((h) => status(h(word.id)));
    if (st.length > 1 && st.every((s) => s === 'learn')) return 'shared';
    return st[0] === 'learn' ? 'review' : null;
  };

  if (firstId && getWord(firstId)) {
    const w = getWord(firstId);
    taken.add(w.id);
    picked.push({ word: w, reason: reasonFor(w) });
  }

  const reviewCap = Math.ceil(count * MAX_REVIEW_SHARE);
  const needsReview = (w) => histories.some((h) => status(h(w.id)) === 'learn');

  while (picked.length < count) {
    const lvl = LEVELS[weightedIndex(weights)];
    const reviewsSoFar = picked.filter((p) => needsReview(p.word)).length;
    let pool = candidates(WORDS_BY_LEVEL[lvl], reviewsSoFar < reviewCap ? (reviewByLevel[lvl] ?? []) : [], taken);
    if (reviewsSoFar >= reviewCap) pool = pool.filter((w) => !needsReview(w));
    if (!pool.length) continue;
    // Squaring sharpens the preference while still leaving some variety.
    const scores = pool.map((w) => wordScore(w, histories, now) ** 2);
    const w = pool[weightedIndex(scores)];
    taken.add(w.id);
    picked.push({ word: w, reason: reasonFor(w) });
  }
  return picked;
}
