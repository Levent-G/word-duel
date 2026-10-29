// Player names are visible to other players (opponents, leaderboards), so offensive ones are refused
// when typed and masked when shown. The list is intentionally short and root-based: it catches the
// common Turkish and English insults including simple disguises (k4f4, s.i.k, ...).

const ROOTS = [
  // Turkish
  'amk', 'amina', 'aminak', 'amcik', 'orospu', 'orosbu', 'pic', 'sik', 'sikis', 'sikim', 'yarrak', 'yarak', 'gavat',
  'kahpe', 'pezevenk', 'ibne', 'got', 'gotveren', 'yavsak', 'serefsiz', 'kaltak', 'sürtük', 'surtuk', 'ananı', 'anani',
  'bok', 'mal', 'gerizekali', 'salak', 'aptal', 'dangalak', 'oc', 'aq',
  // English
  'fuck', 'fuk', 'shit', 'bitch', 'cunt', 'dick', 'cock', 'pussy', 'whore', 'slut', 'nigger', 'nigga', 'fag', 'retard',
  'asshole', 'bastard', 'porn', 'sex', 'nazi', 'hitler',
];
// Short roots only count as whole words, so "Mali", "Gotham" or "Ocak" stay allowed.
const WHOLE_WORD = new Set(['pic', 'got', 'bok', 'mal', 'oc', 'aq', 'amk', 'sik', 'dick', 'cock', 'sex', 'fag', 'fuk']);

const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's', '!': 'i' };
const TR = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' };

function normalise(text) {
  return text
    .toLocaleLowerCase('tr-TR')
    .split('')
    .map((ch) => LEET[ch] ?? TR[ch] ?? ch)
    .join('');
}

const fold = (s) => normalise(s).replace(/[^a-z]/g, '');

export function isOffensive(name) {
  if (!name) return false;
  const words = normalise(name).split(/[^a-z0-9]+/).map((w) => w.replace(/[^a-z]/g, '')).filter(Boolean);
  const joined = fold(name).replace(/(.)\1+/g, '$1');
  return ROOTS.some((root) => {
    const r = fold(root);
    if (WHOLE_WORD.has(r)) return words.includes(r) || joined === r;
    return joined.includes(r.replace(/(.)\1+/g, '$1'));
  });
}

/** Name to show for another player: offensive or empty names become a neutral label. */
export function displayName(name) {
  const n = (name ?? '').trim();
  return !n || isOffensive(n) ? 'Oyuncu' : n;
}

/** Validation for the player's own name; returns an error message or null. */
export function nameError(name) {
  const n = name.trim();
  if (n.length < 2) return 'En az 2 harf yaz.';
  if (n.length > 20) return 'En fazla 20 karakter olabilir.';
  if (isOffensive(n)) return 'Bu ad kullanılamaz. Lütfen başka bir ad seç.';
  return null;
}
