import {
  get,
  limitToLast,
  onDisconnect,
  onValue,
  orderByChild,
  push,
  query,
  ref,
  remove,
  runTransaction,
  serverTimestamp,
  set,
  update,
} from 'firebase/database';

import { deleteUser } from 'firebase/auth';

import { DICT_VERSION } from '../data/dictionary';
import { settle } from '../game/scoring';
import { displayName } from '../moderation';
import { currentUser, db, ensureSignedIn } from './firebase';

/*
 * Realtime Database layout (rules: database.rules.json). Everything runs on the free Spark plan:
 * there is no server code, so the rules are what keep scores honest.
 *   users/{uid}             { name, level, updatedAt }
 *   history/{uid}/{wordId}  { c, w, l, t }                 word history, read by the match host
 *   queue/{level}/{uid}     { name, rating, at, beat, claimedBy? }
 *   pending/{uid}           { matchId }                    "your match is ready", written by the host
 *   rooms/{code}            { host, guest?, level, at }    friend rooms
 *   matches/{id}            { kind, level, at, order, players, questions, answers/{uid}/{i}, presence/{uid} }
 *   ratings/{uid}           { name, rating, matches, wins, lastMatch, at }   online leaderboard
 *   weekly/{week}/{uid}     { name, points, lastMatch }    weekly online leaderboard
 */

export const START_RATING = 1000;
const BEAT_MS = 5000;
const STALE_MS = 20000;
const CLAIM_STALE_MS = 30000;
/** Rating gap accepted at once, and how much it widens per second of waiting. */
const WINDOW_BASE = 100;
const WINDOW_PER_SEC = 20;

const r = (path) => ref(db(), path);

// ---------- profile, history, rating ----------

export async function syncProfile({ name, level }, words) {
  const uid = await ensureSignedIn();
  if (!uid) return;
  const history = {};
  for (const [id, e] of Object.entries(words)) history[id] = { c: e.c, w: e.w, l: e.last, t: e.t ?? 0 };
  await update(r('/'), {
    [`users/${uid}`]: { name: name || 'Oyuncu', level, updatedAt: serverTimestamp() },
    [`history/${uid}`]: history,
  });
}

/** This player's online stats from the server ({ rating, matches, wins }). */
export async function fetchMyRating() {
  const uid = await ensureSignedIn();
  const v = (await get(r(`ratings/${uid}`))).val();
  return { rating: v?.rating ?? START_RATING, matches: v?.matches ?? 0, wins: v?.wins ?? 0 };
}

/** A history lookup (`id → { c, w, last, t }`) for another player, as the word picker expects. */
export async function fetchHistory(uid) {
  const raw = (await get(r(`history/${uid}`))).val() ?? {};
  return (id) => {
    const e = raw[id];
    return e ? { c: e.c, w: e.w, last: e.l, t: e.t } : undefined;
  };
}

// ---------- matches ----------

/** Creates the match as host: builds the questions from both histories and tells the guest. */
async function hostMatch({ me, guest, level, kind, buildSpecs }) {
  const guestHistory = await fetchHistory(guest.uid);
  // Apps before dictionary versions (1.0) send no dv: they only know version 1 words.
  const guestDv = guest.dv ?? 1;
  const matchRef = push(r('matches'));
  await set(matchRef, {
    kind,
    level,
    at: serverTimestamp(),
    order: [me.uid, guest.uid],
    players: {
      [me.uid]: { name: me.name, rating: me.rating, dv: DICT_VERSION },
      [guest.uid]: { name: guest.name, rating: guest.rating, dv: guestDv },
    },
    questions: buildSpecs(guestHistory, Math.min(DICT_VERSION, guestDv)),
  });
  await set(r(`pending/${guest.uid}`), { matchId: matchRef.key, at: serverTimestamp() });
  return matchRef.key;
}

/** Waits for a host to hand this player a match. */
function listenPending(uid, onMatch) {
  const pRef = r(`pending/${uid}`);
  remove(pRef).catch(() => {});
  return onValue(pRef, (snap) => {
    const v = snap.val();
    if (!v?.matchId) return;
    remove(pRef).catch(() => {});
    onMatch({ matchId: v.matchId, role: 'guest' });
  });
}

/** Best waiting partner for `mine`: closest rating within a window that widens while either side waits. */
export function pickPartner(queue, uid, mine, now) {
  let best = null;
  for (const [ouid, o] of Object.entries(queue)) {
    if (ouid === uid || o.claimedBy || now - (o.beat ?? o.at) > STALE_MS) continue;
    if (mine.blocked?.includes(ouid) || o.blocked?.includes(uid)) continue;
    const waited = (now - Math.min(o.at, mine.at)) / 1000;
    const gap = Math.abs((o.rating ?? START_RATING) - (mine.rating ?? START_RATING));
    if (gap > WINDOW_BASE + WINDOW_PER_SEC * waited) continue;
    if (!best || gap < best.gap || (gap === best.gap && o.at < best.entry.at)) best = { uid: ouid, entry: o, gap };
  }
  return best;
}

/**
 * Online matchmaking. Waiting players sit in `queue/{level}`; every few seconds each one tries to
 * claim the closest-rated partner in a single transaction, so two phones can never grab the same
 * player. The claimer becomes host. Returns a cancel function.
 */
export function joinQueue({ level, me, buildSpecs, onMatch, onError }) {
  let cancelled = false;
  let matched = false;
  let stopPending = null;
  let beat = null;
  let uid = null;
  let inFlight = null;
  const queueRef = r(`queue/${level}`);
  const joinedAt = Date.now();

  const stopAll = () => {
    if (beat) clearInterval(beat);
    beat = null;
    stopPending?.();
    stopPending = null;
  };

  const leave = () => {
    if (!uid) return;
    const mineRef = r(`queue/${level}/${uid}`);
    onDisconnect(mineRef).cancel().catch(() => {});
    // A transaction first runs on the local cache, which is often empty here. Returning null (not
    // aborting) for an empty value makes Firebase re-run it with the real server value.
    runTransaction(mineRef, (cur) => (cur?.claimedBy ? undefined : null)).catch(() => {});
  };

  async function tryPair(self) {
    if (cancelled || matched) return;
    let partner = null;
    const finished = runTransaction(queueRef, (q) => {
      partner = null;
      const queue = q ?? {};
      const now = Date.now();
      const mine = queue[uid];
      if (mine?.claimedBy) return undefined;
      for (const [k, v] of Object.entries(queue)) {
        if (v.claimedBy ? now - (v.claimedAt ?? 0) > CLAIM_STALE_MS : now - (v.beat ?? v.at) > STALE_MS * 3) delete queue[k];
      }
      const entry = { name: self.name, rating: self.rating, at: mine?.at ?? joinedAt, beat: now, dv: DICT_VERSION };
      if (self.blocked?.length) entry.blocked = self.blocked.slice(0, 50);
      const best = pickPartner(queue, uid, entry, now);
      if (best) {
        partner = { uid: best.uid, ...best.entry };
        queue[best.uid] = { ...best.entry, claimedBy: uid, claimedAt: now };
        delete queue[uid];
      } else {
        queue[uid] = entry;
      }
      return queue;
    });
    inFlight = finished;
    await finished.finally(() => {
      inFlight = null;
    });
    // Cancelled while this attempt was on the wire: it may have re-added us, so remove again.
    if (cancelled && !partner) {
      leave();
      return;
    }
    if (!partner) return;
    if (cancelled) {
      // We had already claimed someone; release them so they can be matched by others.
      runTransaction(r(`queue/${level}/${partner.uid}`), (cur) => {
        if (cur == null) return null;
        return cur.claimedBy === uid ? { name: cur.name, rating: cur.rating, at: cur.at, beat: Date.now(), ...(cur.dv ? { dv: cur.dv } : {}) } : undefined;
      }).catch(() => {});
      return;
    }
    matched = true;
    stopAll();
    const matchId = await hostMatch({ me: self, guest: partner, level, kind: 'online', buildSpecs });
    remove(r(`queue/${level}/${partner.uid}`)).catch(() => {});
    if (!cancelled) onMatch({ matchId, role: 'host' });
  }

  (async () => {
    try {
      uid = await ensureSignedIn();
      if (cancelled) return;
      const { rating } = await fetchMyRating();
      if (cancelled) return;
      const self = { ...me, rating, uid };

      stopPending = listenPending(uid, (m) => {
        if (cancelled || matched) return;
        matched = true;
        stopAll();
        remove(r(`queue/${level}/${uid}`)).catch(() => {});
        onMatch(m);
      });
      await onDisconnect(r(`queue/${level}/${uid}`)).remove();
      await tryPair(self);
      beat = setInterval(() => tryPair(self).catch((e) => onError?.(e)), BEAT_MS);
    } catch (e) {
      if (!cancelled) onError?.(e);
    }
  })();

  return () => {
    cancelled = true;
    stopAll();
    if (!matched) leave();
    return inFlight ?? Promise.resolve();
  };
}

let presence = null;

/** Marks this player present in the match; the server clears it if the app disconnects. */
export async function enterMatch(matchId) {
  const uid = await ensureSignedIn();
  const pRef = r(`matches/${matchId}/presence/${uid}`);
  await onDisconnect(pRef).remove();
  await set(pRef, true);
  presence = pRef;
  return uid;
}

export function leaveMatch() {
  if (!presence) return;
  const pRef = presence;
  presence = null;
  onDisconnect(pRef).cancel().catch(() => {});
  remove(pRef).catch(() => {});
}

export function listenMatch(matchId, cb) {
  return onValue(r(`matches/${matchId}`), (snap) => cb(snap.val()));
}

export function sendAnswer(matchId, uid, index, pick, time) {
  return set(r(`matches/${matchId}/answers/${uid}/${index}`), { p: pick, t: time ?? -1 }).catch(() => {});
}

/**
 * Settles the match for this player from the shared match record (not from this phone's screen),
 * then writes the new online rating and weekly points once per match. Friend matches are unrated.
 */
export async function settleOnlineMatch(matchId, week, name) {
  const uid = await ensureSignedIn();
  const match = (await get(r(`matches/${matchId}`))).val();
  if (!match) throw new Error('Maç bulunamadı');
  const s = settle(match, uid);
  if (match.kind !== 'online') return { ...s, newRating: null };

  const { tier } = await syncLeague(week);
  const [used, cur, wk] = await Promise.all([
    get(r(`ratingsUsed/${uid}/${matchId}`)),
    get(r(`ratings/${uid}`)),
    get(r(`weekly/${week}/${uid}`)),
  ]);
  const base = cur.val() ?? { rating: START_RATING, matches: 0, wins: 0 };
  if (used.exists()) return { ...s, newRating: base.rating, alreadySettled: true };

  const newRating = base.rating + s.ratingChange;
  // One atomic write: the rules accept the rating only together with the "used" mark for this match.
  await update(r('/'), {
    [`ratingsUsed/${uid}/${matchId}`]: true,
    [`ratings/${uid}`]: {
      name: name || 'Oyuncu',
      rating: newRating,
      matches: (base.matches ?? 0) + 1,
      wins: (base.wins ?? 0) + (s.outcome === 'win' ? 1 : 0),
      lastMatch: matchId,
      at: serverTimestamp(),
    },
    [`weekly/${week}/${uid}`]: {
      name: name || 'Oyuncu',
      points: (wk.val()?.points ?? 0) + s.myScore,
      lastMatch: matchId,
      tier,
    },
  });
  return { ...s, newRating, tier };
}

// ---------- friend rooms ----------

function roomCode() {
  return `WD-${Math.floor(1000 + Math.random() * 9000)}`;
}

/** Opens a room and waits for a friend; the host then builds the match. Returns { code, cancel }. */
export async function createRoom({ me, level, buildSpecs, onMatch, onError }) {
  const uid = await ensureSignedIn();
  const { rating } = await fetchMyRating();
  const self = { ...me, rating, uid };
  let code = roomCode();
  for (let i = 0; i < 5 && (await get(r(`rooms/${code}`))).exists(); i++) code = roomCode();
  const roomRef = r(`rooms/${code}`);
  await set(roomRef, { host: { uid, name: self.name, rating }, level, at: serverTimestamp() });
  await onDisconnect(roomRef).remove();

  let done = false;
  const stop = onValue(r(`rooms/${code}/guest`), async (snap) => {
    const guest = snap.val();
    if (!guest || done) return;
    done = true;
    stop();
    try {
      const matchId = await hostMatch({ me: self, guest, level, kind: 'friend', buildSpecs });
      onDisconnect(roomRef).cancel().catch(() => {});
      remove(roomRef).catch(() => {});
      onMatch({ matchId, role: 'host' });
    } catch (e) {
      onError?.(e);
    }
  });

  return {
    code,
    cancel: () => {
      done = true;
      stop();
      onDisconnect(roomRef).cancel().catch(() => {});
      remove(roomRef).catch(() => {});
    },
  };
}

/** Joins a friend's room. Resolves to a cancel function; rejects with a Turkish message when the code is wrong. */
export async function joinRoom({ code, me, onMatch }) {
  const uid = await ensureSignedIn();
  const { rating } = await fetchMyRating();
  const snap = await get(r(`rooms/${code}`));
  if (!snap.exists()) throw new Error('Bu kodla açık bir oda yok.');
  if (snap.val().host?.uid === uid) throw new Error('Kendi odana katılamazsın.');
  const stopPending = listenPending(uid, (m) => {
    stopPending();
    onMatch(m);
  });
  const res = await runTransaction(r(`rooms/${code}/guest`), (cur) =>
    cur ? undefined : { uid, name: me.name, rating, dv: DICT_VERSION },
  );
  if (!res.committed) {
    stopPending();
    throw new Error('Bu oda dolu.');
  }
  return stopPending;
}

// ---------- safety: reports and account deletion ----------

export const REPORT_REASONS = [
  { key: 'name', label: 'Uygunsuz ad' },
  { key: 'cheat', label: 'Hile yapıyor' },
  { key: 'abuse', label: 'Rahatsız edici davranış' },
  { key: 'other', label: 'Diğer' },
];

/** Files a report about another player; reviewed by hand from the Firebase console. */
export async function reportPlayer(targetUid, reason, matchId = null) {
  const uid = await ensureSignedIn();
  if (!uid || !targetUid || targetUid === uid) return;
  await set(push(r(`reports/${targetUid}`)), { by: uid, reason, matchId, at: serverTimestamp() });
}

/**
 * Deletes everything this player stored on the server and the anonymous account itself.
 * Match records stay with the other player of each match (they only hold the display name).
 */
export async function deleteAccount(recentWeeks) {
  const uid = await ensureSignedIn();
  if (!uid) return;
  const wipe = {
    [`users/${uid}`]: null,
    [`history/${uid}`]: null,
    [`ratings/${uid}`]: null,
    [`ratingsUsed/${uid}`]: null,
    [`leagues/${uid}`]: null,
    [`pending/${uid}`]: null,
  };
  for (const week of recentWeeks) wipe[`weekly/${week}/${uid}`] = null;
  await update(r('/'), wipe);
  const user = currentUser();
  if (user) await deleteUser(user);
}

// ---------- connection ----------

/** Calls `cb(true|false)` whenever the realtime connection to Firebase goes up or down. */
export function listenConnected(cb) {
  return onValue(r('.info/connected'), (snap) => cb(snap.val() === true));
}

// ---------- reactions ----------

export const REACTIONS = [
  { key: 'gg', emoji: '👏', text: 'İyi oyun' },
  { key: 'wow', emoji: '😮', text: 'Vay!' },
  { key: 'close', emoji: '😅', text: 'Kıl payı' },
  { key: 'fast', emoji: '🔥', text: 'Hızlısın' },
];

export function sendReaction(matchId, uid, key) {
  return set(r(`matches/${matchId}/reactions/${uid}`), { k: key, at: serverTimestamp() }).catch(() => {});
}

// ---------- rematch ----------

/**
 * Asks for a rematch with the same opponent. When both players asked, the original host builds
 * the new match and the other one receives it through `pending`. `onState({ mine, theirs })`
 * reports who asked; `theirs === false` means the opponent left. Returns a cancel function.
 */
export function requestRematch({ matchId, me, buildSpecs, onMatch, onState }) {
  let done = false;
  let stopPending = null;
  let stopWatch = null;
  let uid = null;

  (async () => {
    uid = await ensureSignedIn();
    const match = (await get(r(`matches/${matchId}`))).val();
    if (!match || done) return;
    const oppUid = match.order.find((u) => u !== uid);
    const isHost = match.order[0] === uid;

    stopPending = listenPending(uid, (m) => {
      if (done) return;
      done = true;
      cleanup();
      onMatch(m);
    });
    await set(r(`matches/${matchId}/rematch/${uid}`), true);

    stopWatch = onValue(r(`matches/${matchId}/rematch`), async (snap) => {
      const v = snap.val() ?? {};
      onState?.({ mine: v[uid] === true, theirs: v[oppUid] });
      if (done || !isHost || v[uid] !== true || v[oppUid] !== true) return;
      done = true;
      cleanup();
      const [myRating, theirRating] = await Promise.all([
        get(r(`ratings/${uid}/rating`)),
        get(r(`ratings/${oppUid}/rating`)),
      ]);
      const self = { uid, name: me.name, rating: myRating.val() ?? START_RATING };
      const guest = { uid: oppUid, name: match.players[oppUid].name, rating: theirRating.val() ?? START_RATING, dv: match.players[oppUid].dv ?? 1 };
      const newId = await hostMatch({ me: self, guest, level: match.level, kind: match.kind, buildSpecs });
      onMatch({ matchId: newId, role: 'host' });
    });
  })().catch(() => onState?.({ mine: false, theirs: false, failed: true }));

  function cleanup() {
    stopPending?.();
    stopWatch?.();
    stopPending = null;
    stopWatch = null;
  }

  return () => {
    if (!done && uid) set(r(`matches/${matchId}/rematch/${uid}`), false).catch(() => {});
    done = true;
    cleanup();
  };
}

/** Watches whether the opponent asked for a rematch, without asking yourself. */
export function watchRematch(matchId, cb) {
  let stop = () => {};
  ensureSignedIn().then(async (uid) => {
    const match = (await get(r(`matches/${matchId}`))).val();
    if (!match) return;
    const oppUid = match.order.find((u) => u !== uid);
    stop = onValue(r(`matches/${matchId}/rematch/${oppUid}`), (snap) => cb(snap.val()));
  });
  return () => stop();
}

/** Tells the opponent this player left the result screen (declines any rematch). */
export async function declineRematch(matchId) {
  const uid = await ensureSignedIn();
  const cur = (await get(r(`matches/${matchId}/rematch/${uid}`))).val();
  if (cur !== true) await set(r(`matches/${matchId}/rematch/${uid}`), false).catch(() => {});
}

// ---------- leagues ----------

export const LEAGUES = [
  { name: 'Bronz', color: '#A65A24', soft: '#FBE5D6' },
  { name: 'Gümüş', color: '#5B6576', soft: '#EDF1F5' },
  { name: 'Altın', color: '#B07A00', soft: '#FFF1C7' },
  { name: 'Platin', color: '#2E8C9A', soft: '#E1F4F6' },
  { name: 'Elmas', color: '#4C7CF0', soft: '#EDF2FE' },
];
export const PROMOTE_TOP = 10;
export const DEMOTE_BOTTOM = 5;
/** Demotion only applies when the group is big enough for "bottom 5" to mean something. */
export const DEMOTE_MIN_GROUP = 15;

async function weeklyRows(week) {
  const snap = await get(query(r(`weekly/${week}`), orderByChild('points'), limitToLast(1000)));
  const rows = [];
  snap.forEach((child) => {
    const v = child.val();
    rows.push({ uid: child.key, name: displayName(v.name), points: v.points ?? 0, tier: v.tier ?? 0 });
  });
  return rows.sort((a, b) => b.points - a.points);
}

/** Promotion / demotion for one finished week: `rows` of that week, `tier` the player's tier then. */
export function leagueMove(rows, uid, tier) {
  const group = rows.filter((row) => row.tier === tier);
  const rank = group.findIndex((row) => row.uid === uid) + 1;
  if (!rank) return 0;
  if (rank <= PROMOTE_TOP && group[rank - 1].points > 0 && tier < LEAGUES.length - 1) return 1;
  if (group.length >= DEMOTE_MIN_GROUP && rank > group.length - DEMOTE_BOTTOM && tier > 0) return -1;
  return 0;
}

/**
 * Places the player in this week's league, applying last week's result once.
 * Returns { tier, change } (change: +1 promoted, -1 relegated, 0 stayed).
 */
export async function syncLeague(week) {
  const uid = await ensureSignedIn();
  const lRef = r(`leagues/${uid}`);
  const cur = (await get(lRef)).val();
  if (cur?.week === week) return { tier: cur.tier, change: 0 };
  if (!cur) {
    await set(lRef, { tier: 0, week });
    return { tier: 0, change: 0 };
  }
  const change = leagueMove(await weeklyRows(cur.week), uid, cur.tier);
  const tier = cur.tier + change;
  await set(lRef, { tier, week, prev: cur.week });
  return { tier, change };
}

/** This week's table for one league, with promotion/relegation zones marked. */
export async function fetchLeague(week, tier) {
  const uid = await ensureSignedIn();
  const group = (await weeklyRows(week)).filter((row) => row.tier === tier);
  return group.map((row, i) => ({
    uid: row.uid,
    name: row.name,
    value: row.points,
    me: row.uid === uid,
    rank: i + 1,
    zone:
      i < PROMOTE_TOP && tier < LEAGUES.length - 1
        ? 'up'
        : group.length >= DEMOTE_MIN_GROUP && i >= group.length - DEMOTE_BOTTOM && tier > 0
          ? 'down'
          : null,
  }));
}

// ---------- leaderboards ----------

export async function fetchLeaderboard(period, week) {
  const uid = await ensureSignedIn();
  const q =
    period === 'week'
      ? query(r(`weekly/${week}`), orderByChild('points'), limitToLast(50))
      : query(r('ratings'), orderByChild('rating'), limitToLast(50));
  const snap = await get(q);
  const rows = [];
  snap.forEach((child) => {
    const v = child.val();
    rows.push({
      uid: child.key,
      name: displayName(v.name),
      value: period === 'week' ? v.points ?? 0 : v.rating ?? 0,
      me: child.key === uid,
    });
  });
  rows.sort((a, b) => b.value - a.value);
  return rows.map((row, i) => ({ ...row, rank: i + 1 }));
}
