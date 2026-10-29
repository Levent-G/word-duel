import { WORDS_BY_LEVEL, getWord, lower, shortMeaning } from '../data/dictionary';
import { pickWords } from './wordPicker';

export function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const pick = (list) => list[Math.floor(Math.random() * list.length)];

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Sentence with the target word blanked out, or null when the example does not contain it verbatim. */
function blankSentence(word) {
  if (!word.e || word.en.includes(' ')) return null;
  const re = new RegExp(`\\b${escapeRegExp(word.en)}\\b`, 'i');
  if (!re.test(word.e)) return null;
  return word.e.replace(re, '_____');
}

/** Wrong options: same level (and part of speech when possible), never sharing a spelling or a meaning with another option. */
function distractors(word) {
  const pool = WORDS_BY_LEVEL[word.l];
  const usedEn = new Set([word.en.toLowerCase()]);
  const usedTr = new Set([lower(shortMeaning(word))]);
  const out = [];
  const samePos = pool.filter((w) => w.p === word.p);
  for (const source of [samePos, pool]) {
    for (let tries = 0; tries < 60 && out.length < 3; tries++) {
      const w = pick(source);
      const en = w.en.toLowerCase();
      const tr = lower(shortMeaning(w));
      if (w.id === word.id || usedEn.has(en) || usedTr.has(tr)) continue;
      usedEn.add(en);
      usedTr.add(tr);
      out.push(w);
    }
  }
  return out;
}

function makeQuestion(word, forcedType) {
  const sentence = blankSentence(word);
  const roll = Math.random();
  let type = forcedType ?? (roll < 0.55 ? 'meaning' : roll < 0.8 ? 'reverse' : 'blank');
  if (type === 'blank' && !sentence) type = 'meaning';

  const wrong = distractors(word);
  if (type === 'meaning') {
    return {
      type,
      word,
      prompt: 'Bu kelimenin anlamı ne?',
      text: word.en,
      options: shuffle([word, ...wrong]).map((w) => ({ id: w.id, label: shortMeaning(w) })),
    };
  }

  const options = shuffle([word, ...wrong]).map((w) => ({ id: w.id, label: w.en }));
  if (type === 'reverse') {
    return { type, word, prompt: 'İngilizcesi hangisi?', text: shortMeaning(word), options };
  }
  return { type, word, prompt: 'Boşluğa hangi kelime gelir?', text: sentence, options };
}

/** Compact form sent to the other player: word id, type and option ids (both apps share the dictionary). */
export function serializeQuestions(questions) {
  return questions.map((q) => ({ w: q.word.id, t: q.type, o: q.options.map((o) => o.id), s: q.reason === 'shared' ? 1 : 0 }));
}

/** Rebuilds questions from `serializeQuestions`; `mine` is this player's history, used for the review tag. */
export function hydrateQuestions(specs, mine) {
  return specs.map((sp) => {
    const word = getWord(sp.w);
    const options = sp.o.map(getWord).map((w) => ({ id: w.id, label: sp.t === 'meaning' ? shortMeaning(w) : w.en }));
    const prompt = { meaning: 'Bu kelimenin anlamı ne?', reverse: 'İngilizcesi hangisi?', blank: 'Boşluğa hangi kelime gelir?' }[sp.t];
    const text = sp.t === 'meaning' ? word.en : sp.t === 'reverse' ? shortMeaning(word) : blankSentence(word);
    const reason = sp.s ? 'shared' : mine(word.id)?.last === 0 ? 'review' : null;
    return { type: sp.t, word, prompt, text, options, reason };
  });
}

/**
 * @param count     number of questions
 * @param level     CEFR level chosen in settings
 * @param histories one word-history lookup per player (see wordPicker)
 * @param reviewIds ids any player still has to learn
 * @param firstId   optional word that must come first (practice from word detail)
 */
export function buildQuestions({ count, level, histories, reviewIds, firstId }) {
  return pickWords({ count, level, histories, reviewIds, firstId }).map(({ word, reason }, i) => ({
    ...makeQuestion(word, i === 0 && firstId ? 'meaning' : undefined),
    reason,
  }));
}
