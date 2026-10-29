// Partner choice and scoring rules (no network): node scripts/test-matchmaking.mjs
import { register } from 'node:module';

register(
  'data:text/javascript,' +
    encodeURIComponent(`
export async function resolve(spec, ctx, next) {
  if (spec === './firebase') return { url: 'data:text/javascript,export const db=()=>null;export const ensureSignedIn=async()=>null;export const currentUser=()=>null;', shortCircuit: true };
  if (spec === '@react-native-async-storage/async-storage') return { url: 'data:text/javascript,export default {};', shortCircuit: true };
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

const { pickPartner } = await import('../src/online/api.js');
const { eloChange, pointsFor, scoreFromRecord, settle } = await import('../src/game/scoring.js');

let failures = 0;
const check = (ok, msg) => {
  if (!ok) failures++;
  console.log(ok ? 'ok  ' : 'FAIL', msg);
};

const now = 1_000_000;
const q = {
  close: { rating: 1050, at: now - 1000, beat: now },
  far: { rating: 1600, at: now - 1000, beat: now },
  stale: { rating: 1000, at: now - 60000, beat: now - 60000 },
  claimed: { rating: 1000, at: now, beat: now, claimedBy: 'x' },
};
check(pickPartner(q, 'me', { rating: 1000, at: now }, now)?.uid === 'close', 'picks the closest rating, skips stale and claimed');
check(!pickPartner({ far: q.far }, 'me', { rating: 1000, at: now }, now), 'a 600-point gap is refused at first');
check(
  pickPartner({ far: { ...q.far, at: now - 30000 } }, 'me', { rating: 1000, at: now }, now)?.uid === 'far',
  'the window widens after 30 s of waiting (100 + 20/s)',
);
check(!pickPartner({ me: { rating: 1000, at: now, beat: now } }, 'me', { rating: 1000, at: now }, now), 'never pairs with itself');

check(pointsFor(0) === 98 && pointsFor(10) === 50 && pointsFor(-5) === 98, 'points are clamped to 50…98');
check(eloChange(1000, 1000, 1) === 16 && eloChange(1000, 1000, 0) === -16, 'equal ratings: ±16');
check(eloChange(1000, 1400, 1) === 29 && eloChange(1400, 1000, 0) === -29, 'upsets pay more');
check(Math.abs(eloChange(500, 2500, 1)) <= 40, 'rating step never exceeds the rules limit');

const specs = [{ w: 'a' }, { w: 'b' }, { w: 'c' }];
check(scoreFromRecord(specs, { 0: { p: 'a', t: 2 }, 1: { p: 'x', t: 1 }, 2: { p: 'c', t: -1 } }).score === pointsFor(2), 'wrong and timed-out answers score nothing');

const match = {
  kind: 'online',
  order: ['u1', 'u2'],
  questions: specs,
  players: { u1: { rating: 1000 }, u2: { rating: 1000 } },
  answers: { u1: { 0: { p: 'x', t: 1 }, 1: { p: 'x', t: 1 }, 2: { p: 'x', t: 1 } }, u2: { 0: { p: 'a', t: 1 } } },
  presence: { u1: true },
};
const s = settle(match, 'u1');
check(s.outcome === 'win' && s.oppForfeit, 'leaving early forfeits, even when ahead on points');
check(settle({ ...match, kind: 'friend' }, 'u1').ratingChange === 0, 'friend matches are unrated');

// ----- streak freeze -----
const { nextStreak, streakStatus } = await import('../src/store.js');
const s0 = { last: '2026-10-26', count: 5, best: 5 }; // Monday
const s1 = nextStreak(s0, '2026-10-27');
check(s1.count === 6, 'playing the next day extends the streak');
const s2 = nextStreak(s1, '2026-10-29');
check(s2.count === 7 && s2.freezeWeek === '2026-10-26', 'one missed day is forgiven and the freeze is spent');
const s3 = nextStreak(s2, '2026-10-31');
check(s3.count === 1, 'a second missed day in the same week breaks the streak');
const s4 = nextStreak({ ...s2, last: '2026-11-01' }, '2026-11-03');
check(s4.count === 8, 'the freeze comes back the next week');
check(nextStreak(s0, '2026-10-29').count === 1 && nextStreak({ last: '2026-10-26', count: 5, best: 5 }, '2026-10-29').count === 1, 'two missed days are not forgiven');
check(streakStatus(s1, '2026-10-29').willFreeze && streakStatus(s1, '2026-10-29').count === 6, 'status shows the streak protected after one missed day');
check(streakStatus(s1, '2026-10-30').count === 0, 'status shows the streak lost after two missed days');
check(streakStatus(s1, '2026-10-27').playedToday && !streakStatus(s1, '2026-10-27').atRisk, 'played today: not at risk');

// ----- leagues -----
const { leagueMove } = await import('../src/online/api.js');
const group = (n, tier) => Array.from({ length: n }, (_, i) => ({ uid: `p${i + 1}`, points: 1000 - i * 10, tier }));
const g20 = [...group(20, 1), { uid: 'other', points: 5000, tier: 2 }];
check(leagueMove(g20, 'p1', 1) === 1 && leagueMove(g20, 'p10', 1) === 1, 'top 10 of the league move up (other leagues ignored)');
check(leagueMove(g20, 'p11', 1) === 0, '11th stays');
check(leagueMove(g20, 'p16', 1) === -1 && leagueMove(g20, 'p20', 1) === -1, 'bottom 5 move down');
check(leagueMove(group(12, 1), 'p12', 1) === 0, 'no relegation in small groups');
check(leagueMove(group(20, 0), 'p20', 0) === 0, 'nobody drops below Bronz');
check(leagueMove(group(5, 4), 'p1', 4) === 0, 'nobody rises above Elmas');
check(leagueMove(group(20, 1), 'ghost', 1) === 0, 'players who did not play stay');
check(leagueMove([{ uid: 'p1', points: 0, tier: 1 }], 'p1', 1) === 0, 'zero points do not promote');

console.log(failures ? `${failures} failures` : 'matchmaking checks passed');
process.exit(failures ? 1 : 0);
