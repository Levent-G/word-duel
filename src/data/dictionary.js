import RAW from './words.json';

export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export const WORDS = RAW;
export const WORD_BY_ID = Object.fromEntries(RAW.map((w) => [w.id, w]));
export const WORDS_BY_LEVEL = LEVELS.reduce((acc, l) => {
  acc[l] = RAW.filter((w) => w.l === l);
  return acc;
}, {});

export const getWord = (id) => WORD_BY_ID[id];

/**
 * Dictionary version: every word carries the version it arrived in (`dv`, missing = 1, the 1.0 app).
 * Online matches against an older app only use words that app also has.
 */
export const DICT_VERSION = RAW.reduce((m, w) => Math.max(m, w.dv ?? 1), 1);
export const inDict = (w, dv = DICT_VERSION) => (w.dv ?? 1) <= dv;
const byLevelCache = {};
export function wordsByLevel(dv = DICT_VERSION) {
  if (dv >= DICT_VERSION) return WORDS_BY_LEVEL;
  return (byLevelCache[dv] ??= LEVELS.reduce((acc, l) => {
    acc[l] = WORDS_BY_LEVEL[l].filter((w) => inDict(w, dv));
    return acc;
  }, {}));
}

/** Words an online opponent's newer app sent along; kept for this session so summary/detail screens can show them. */
export const rememberWord = (w) => {
  WORD_BY_ID[w.id] ??= w;
  return WORD_BY_ID[w.id];
};

/** First sense of a translation, for compact answer buttons ("haklı çıkarmak / temize çıkarmak" → "haklı çıkarmak"). */
export const shortMeaning = (w) => w.tr.split(/\s*[/;]\s*/)[0];

export const lower = (s) => s.toLocaleLowerCase('tr-TR');

export function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function wordOfDay(level, date = todayKey()) {
  const pool = WORDS_BY_LEVEL[level] ?? RAW;
  return pool[hash(date + level) % pool.length];
}

export function searchWords(query, limit = 40) {
  const q = lower(query.trim());
  if (q.length < 2) return [];
  const starts = [];
  const contains = [];
  for (const w of RAW) {
    const en = w.en.toLowerCase();
    if (en.startsWith(q)) starts.push(w);
    else if (en.includes(q) || lower(w.tr).includes(q)) contains.push(w);
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit);
}
