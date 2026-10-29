// Two-player online test against the Firebase emulators (npx firebase-tools emulators:start --only database,auth).
// Usage: node scripts/test-online.mjs            (spawns both players)
//        node scripts/test-online.mjs <A|B> <scenario> <syncFile>   (one player, used internally)
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { register } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const self = fileURLToPath(import.meta.url);
const [, , role, scenario, syncFile] = process.argv;

if (!role) {
  let failed = 0;
  for (const sc of ['lobby', 'room', 'cancel']) {
    const file = join(tmpdir(), `wd-sync-${sc}-${Date.now()}.txt`);
    rmSync(file, { force: true });
    const run = (r) =>
      new Promise((res) => {
        const p = spawn(process.execPath, ['--no-warnings', self, r, sc, file], { stdio: ['ignore', 'pipe', 'pipe'] });
        let out = '';
        p.stdout.on('data', (d) => (out += d));
        p.stderr.on('data', (d) => (out += d));
        p.on('exit', (code) => res({ code, out }));
      });
    const [a, b] = await Promise.all([run('A'), run('B')]);
    for (const [name, res] of [['A', a], ['B', b]]) {
      console.log(`--- ${sc} / player ${name} (exit ${res.code})\n${res.out.trim()}`);
      if (res.code !== 0) failed++;
    }
  }
  console.log(failed ? `${failed} player runs failed` : 'online checks passed');
  process.exit(failed ? 1 : 0);
}

// ----- one player -----
register(
  'data:text/javascript,' +
    encodeURIComponent(`
const shim = ${JSON.stringify(new URL('./online-shim.mjs', import.meta.url).href)};
export async function resolve(spec, ctx, next) {
  if (spec === './firebase' && ctx.parentURL && ctx.parentURL.includes('/src/online/')) return { url: shim, shortCircuit: true };
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

const api = await import('../src/online/api.js');
const { ensureSignedIn, db } = await import('./online-shim.mjs');
const { buildQuestions, serializeQuestions, hydrateQuestions } = await import('../src/game/questions.js');
const { ref, set } = await import('firebase/database');

const log = (...a) => console.log(`[${role}]`, ...a);
const die = (msg) => {
  console.log(`[${role}] FAIL ${msg}`);
  process.exit(1);
};
setTimeout(() => die('timed out'), 40000).unref();

const waitFor = (pred, ms = 15000) =>
  new Promise((res, rej) => {
    const start = Date.now();
    const t = setInterval(() => {
      const v = pred();
      if (v) {
        clearInterval(t);
        res(v);
      } else if (Date.now() - start > ms) {
        clearInterval(t);
        rej(new Error('waitFor timeout'));
      }
    }, 50);
  });

const me = { name: role === 'A' ? 'Ayşe Test' : 'Bora Test', rating: role === 'A' ? 1100 : 1180 };
const uid = await ensureSignedIn();
log('signed in', uid.slice(0, 6));

// Some word history so the host has something to read.
await api.syncProfile({ ...me, level: 'B1', matches: 0, wins: 0 }, { b1_359: { c: 0, w: 1, last: 0, t: 1 } });

const buildSpecs = (guestHistory) =>
  serializeQuestions(buildQuestions({ count: 3, level: 'B1', histories: [() => undefined, guestHistory] }));

if (scenario === 'cancel') {
  const { get: dbGet, ref: dbRef } = await import('firebase/database');
  const inQueue = async (who = uid) => (await dbGet(dbRef(db(), `queue/A2/${who}`))).exists();
  const never = () => die('matched while testing cancel');
  if (role === 'A') {
    // 1. Cancel while waiting.
    let cancel = api.joinQueue({ level: 'A2', me, buildSpecs, onMatch: never, onError: (e) => die(e.message) });
    await new Promise((res) => setTimeout(res, 1500));
    if (!(await inQueue())) die('not in the queue while waiting');
    await cancel();
    await new Promise((res) => setTimeout(res, 800));
    if (await inQueue()) die('still in the queue after cancel');
    log('cancel while waiting: removed from the queue');

    // 2. Cancel while a pairing attempt is on the wire, at several moments.
    for (const delay of [0, 30, 80, 150, 300]) {
      cancel = api.joinQueue({ level: 'A2', me, buildSpecs, onMatch: never, onError: (e) => die(e.message) });
      await new Promise((res) => setTimeout(res, delay));
      await cancel();
      await new Promise((res) => setTimeout(res, 800));
      if (await inQueue()) die(`left behind in the queue (cancel after ${delay} ms)`);
    }
    log('cancel during sign-in / pairing: never left behind');

    // 3. App killed without cancelling: the server-side onDisconnect must clean up.
    api.joinQueue({ level: 'A2', me, buildSpecs, onMatch: never, onError: (e) => die(e.message) });
    await new Promise((res) => setTimeout(res, 1500));
    if (!(await inQueue())) die('not in the queue before the crash');
    writeFileSync(syncFile, uid);
    log('crashing on purpose');
    process.exit(0);
  } else {
    await waitFor(() => existsSync(syncFile) && readFileSync(syncFile, 'utf8'), 30000);
    const other = readFileSync(syncFile, 'utf8');
    const start = Date.now();
    while (await inQueue(other)) {
      if (Date.now() - start > 10000) die('crashed player still in the queue after 10 s');
      await new Promise((res) => setTimeout(res, 250));
    }
    log(`crashed player removed by the server after ${((Date.now() - start) / 1000).toFixed(1)} s`);
    log('OK');
    process.exit(0);
  }
}

let match;
if (scenario === 'lobby') {
  // Stagger so A waits and B pairs with A.
  if (role === 'B') await new Promise((r) => setTimeout(r, 1500));
  match = await new Promise((resolve, reject) => {
    api.joinQueue({ level: 'B1', me, buildSpecs, onMatch: resolve, onError: reject });
  });
} else {
  if (role === 'A') {
    match = await new Promise(async (resolve, reject) => {
      const room = await api.createRoom({ me, level: 'B1', buildSpecs, onMatch: resolve, onError: reject });
      writeFileSync(syncFile, room.code);
      log('room open', room.code);
    });
  } else {
    await waitFor(() => existsSync(syncFile) && readFileSync(syncFile, 'utf8'));
    const code = readFileSync(syncFile, 'utf8');
    try {
      await api.joinRoom({ code: 'WD-0000', me, onMatch: () => {} });
      die('joined a room that does not exist');
    } catch (e) {
      log('bad code rejected:', e.message);
    }
    match = await new Promise((resolve, reject) => {
      api.joinRoom({ code, me, onMatch: resolve }).catch(reject);
    });
  }
}
log('matched as', match.role, match.matchId.slice(-6));

await api.enterMatch(match.matchId);
let latest = null;
const stop = api.listenMatch(match.matchId, (v) => (latest = v));
await waitFor(() => latest?.questions && latest?.presence && Object.keys(latest.presence).length === 2);
const oppUid = latest.order.find((u) => u !== uid);
const questions = hydrateQuestions(latest.questions, () => undefined);
log('both present,', questions.length, 'questions, first:', questions[0].text);
if (latest.players[oppUid].name === me.name) die('opponent is myself');

// Rules: writing the opponent's answer must be refused.
try {
  await set(ref(db(), `matches/${match.matchId}/answers/${oppUid}/0`), { p: 'x', t: 1 });
  die('could write the opponent answer');
} catch {
  log('rules: opponent answers are read-only');
}

for (let i = 0; i < questions.length; i++) {
  const q = questions[i];
  const pick = role === 'A' ? q.word.id : q.options.find((o) => o.id !== q.word.id).id;
  await api.sendAnswer(match.matchId, uid, i, pick, 1.5 + i);
  const theirs = await waitFor(() => latest?.answers?.[oppUid]?.[i]);
  const right = theirs.p === q.word.id;
  log(`q${i + 1}: opponent answered ${right ? 'right' : 'wrong'} in ${theirs.t}s`);
  if (right !== (role === 'B')) die(`q${i + 1}: unexpected opponent answer`);
}

api.leaveMatch();
await waitFor(() => !latest?.presence?.[uid]);
log('left the match');
stop();

// Settlement from the shared record: A answered everything right, B everything wrong.
const week = '2026-10-26';
const s = await api.settleOnlineMatch(match.matchId, week, me.name);
log(`settled: ${s.outcome}, ${s.myScore}-${s.opScore}, rating ${s.ratingChange} → ${s.newRating}`);
if (scenario === 'room') {
  if (s.ratingChange !== 0 || s.newRating !== null) die('friend match changed the rating');
} else {
  const expected = role === 'A' ? ['win', 16, 1016] : ['loss', -16, 984];
  if (s.outcome !== expected[0] || s.ratingChange !== expected[1] || s.newRating !== expected[2]) {
    die(`expected ${expected.join(' ')}`);
  }
  const again = await api.settleOnlineMatch(match.matchId, week, me.name);
  if (!again.alreadySettled || again.newRating !== s.newRating) die('match settled twice');
  log('second settle ignored');

  const { update } = await import('firebase/database');
  const attempts = {
    'replay the same match': {
      [`ratings/${uid}`]: { name: me.name, rating: s.newRating + 30, matches: 2, wins: 1, lastMatch: match.matchId },
    },
    'invent a match': {
      [`ratingsUsed/${uid}/fake-match`]: true,
      [`ratings/${uid}`]: { name: me.name, rating: s.newRating + 30, matches: 2, wins: 1, lastMatch: 'fake-match' },
    },
    'jump 500 points': {
      [`ratings/${uid}`]: { name: me.name, rating: s.newRating + 500, matches: 2, wins: 2, lastMatch: match.matchId },
    },
    'weekly points out of thin air': {
      [`weekly/${week}/${uid}`]: { name: me.name, points: 99999, lastMatch: match.matchId },
    },
  };
  for (const [what, patch] of Object.entries(attempts)) {
    try {
      await update(ref(db(), '/'), patch);
      die(`rules allowed: ${what}`);
    } catch {
      log(`rules refused: ${what}`);
    }
  }
  // League: the weekly entry carries this week's tier; skipping a tier is refused.
  const { get: dbGet } = await import('firebase/database');
  const league = (await dbGet(ref(db(), `leagues/${uid}`))).val();
  const weeklyMine = (await dbGet(ref(db(), `weekly/${week}/${uid}`))).val();
  if (league?.tier !== 0 || league.week !== week || weeklyMine?.tier !== 0) die('league placement missing');
  try {
    await set(ref(db(), `leagues/${uid}`), { tier: 2, week: '2026-11-02' });
    die('rules allowed jumping two leagues');
  } catch {
    log('rules refused: jumping two leagues at once');
  }
  const table = await api.fetchLeague(week, 0);
  if (!table.find((row) => row.me)) die('not listed in my league table');
  log(`league table: ${table.length} players, my zone: ${table.find((row) => row.me).zone ?? 'none'}`);

  const board = await api.fetchLeaderboard('all', week);
  const mineRow = board.find((row) => row.me);
  if (mineRow?.value !== s.newRating) die('leaderboard does not show the settled rating');
  const weekly = await api.fetchLeaderboard('week', week);
  if (weekly.find((row) => row.me)?.value !== s.myScore && s.myScore > 0) die('weekly points missing');
  log(`leaderboard rank ${mineRow.rank}, weekly ${weekly.find((row) => row.me)?.value ?? 0}`);
}

// Reactions travel to the opponent.
const watchStop = api.listenMatch(match.matchId, (v) => (latest = v));
await api.sendReaction(match.matchId, uid, role === 'A' ? 'gg' : 'fast');
const theirReaction = await waitFor(() => latest?.reactions?.[oppUid]?.k);
log(`reaction received: ${theirReaction}`);
if (theirReaction !== (role === 'A' ? 'fast' : 'gg')) die('wrong reaction received');
watchStop();

// Rematch: both ask, both land in the same new match.
const next = await new Promise((resolve) => {
  api.requestRematch({ matchId: match.matchId, me, buildSpecs, onMatch: resolve, onState: () => {} });
});
writeFileSync(`${syncFile}.${role}`, next.matchId);
const otherId = await waitFor(() => {
  const f = `${syncFile}.${role === 'A' ? 'B' : 'A'}`;
  return existsSync(f) && readFileSync(f, 'utf8');
});
if (otherId !== next.matchId) die(`rematch split: ${next.matchId} vs ${otherId}`);
await api.enterMatch(next.matchId);
let again = null;
const stopAgain = api.listenMatch(next.matchId, (v) => (again = v));
await waitFor(() => again?.presence && Object.keys(again.presence).length === 2);
if (again.kind !== (scenario === 'room' ? 'friend' : 'online')) die('rematch changed the match kind');
log(`rematch ok: both in ${next.matchId.slice(-6)} as ${next.role}`);
stopAgain();
api.leaveMatch();

// Safety: A reports B, B deletes the account, A sees B's data gone.
if (scenario === 'lobby') {
  const { get: dbGet } = await import('firebase/database');
  if (role === 'A') {
    await api.reportPlayer(oppUid, 'name', match.matchId);
    log('report filed');
    await waitFor(() => existsSync(`${syncFile}.deleted`), 20000);
    const leftovers = await Promise.all(
      ['users', 'history', 'ratings', 'leagues', `weekly/${week}`].map(async (p) => (await dbGet(ref(db(), `${p}/${oppUid}`))).exists()),
    );
    if (leftovers.some(Boolean)) die(`deleted player still has data: ${leftovers}`);
    log('deleted player has no data left');
  } else {
    await new Promise((res) => setTimeout(res, 500));
    await api.deleteAccount([week]);
    writeFileSync(`${syncFile}.deleted`, '1');
    log('account deleted');
  }
}
log('OK');
process.exit(0);
