const NAMES = [
  'Can Demir', 'Elif Kaya', 'Mert Aydın', 'Zeynep Arslan', 'Ali Çelik', 'Ayşe Yıldız', 'Emre Şahin',
  'Selin Koç', 'Burak Öztürk', 'Ece Aksoy', 'Kerem Polat', 'İrem Doğan', 'Onur Kılıç', 'Defne Erdem',
  'Yusuf Aslan', 'Melis Tekin', 'Barış Güneş', 'Nil Karaca', 'Arda Yalçın', 'Sena Uçar',
];

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function findOpponent(rating) {
  const name = NAMES[Math.floor(Math.random() * NAMES.length)];
  const r = Math.max(800, Math.round(rating + (Math.random() - 0.5) * 160));
  return { name, rating: r };
}

/** Chance the bot answers correctly; stronger bots are more accurate. */
export function botAccuracy(rating) {
  return Math.min(0.9, Math.max(0.45, 0.6 + (rating - 1000) / 2000));
}

/**
 * Leaderboard rows around the player. Bots are deterministic per period so the table
 * does not reshuffle on every visit.
 */
export function leaderboard({ name, rating, weekPoints }, period, weekKey) {
  const rand = seeded(period === 'week' ? hashStr(weekKey) : 7);
  const rows = NAMES.map((n) => {
    const base = 900 + Math.round(rand() * 900);
    return { name: n, value: period === 'week' ? Math.round(rand() * 1200) : base, me: false };
  });
  rows.push({ name, value: period === 'week' ? weekPoints : rating, me: true });
  rows.sort((a, b) => b.value - a.value || (a.me ? -1 : 1));
  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

const LEVEL_EASE = { A1: 0.9, A2: 0.8, B1: 0.65, B2: 0.5, C1: 0.38, C2: 0.25 };

/**
 * Stand-in word history for a bot, in the same shape as a real player's (`id → entry`).
 * Deterministic per bot, so the same rival "knows" the same words every match. A real online
 * opponent will send their own history instead.
 */
export function botHistory(opponent, wordLevel) {
  const skill = Math.min(1, Math.max(0, (opponent.rating - 800) / 1000));
  return (id) => {
    const r = (hashStr(`${opponent.name}|${id}`) % 10000) / 10000;
    if (r > 0.45) return undefined;
    const ease = LEVEL_EASE[wordLevel(id)] ?? 0.5;
    const knows = (hashStr(`${id}|${opponent.name}`) % 1000) / 1000 < ease * (0.6 + 0.4 * skill);
    return { c: knows ? 2 : 0, w: knows ? 0 : 1, last: knows ? 1 : 0, t: 0 };
  };
}

function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(h, 31) + str.charCodeAt(i)) >>> 0;
  return h;
}
