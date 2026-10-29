export const QUESTION_SECONDS = 10;
/** Answers faster than this are treated as this fast, so a tampered "0 s" gains nothing extra. */
const MIN_TIME = 0.4;
export const ELO_K = 32;
/** Firebase rules refuse any larger online rating change per match. */
export const MAX_RATING_STEP = 40;
/** 10 questions × at most 100 points. */
export const MAX_MATCH_POINTS = 1000;

/** Points for a correct answer given after `time` seconds. */
export function pointsFor(time) {
  const t = Math.min(QUESTION_SECONDS, Math.max(MIN_TIME, time));
  return 50 + Math.round((QUESTION_SECONDS - t) * 5);
}

/** Score of one player from the shared match record: `specs` = match questions, `answers` = { index: { p, t } }. */
export function scoreFromRecord(specs, answers = {}) {
  let score = 0;
  let correct = 0;
  specs.forEach((sp, i) => {
    const a = answers[i];
    if (!a || a.t < 0 || a.p !== sp.w) return;
    correct++;
    score += pointsFor(a.t);
  });
  return { score, correct, answered: Object.keys(answers).length };
}

/** Elo change for a player rated `mine` against `theirs`; `result` is 1 win, 0.5 draw, 0 loss. */
export function eloChange(mine, theirs, result) {
  const expected = 1 / (1 + 10 ** ((theirs - mine) / 400));
  const delta = Math.round(ELO_K * (result - expected));
  return Math.max(-MAX_RATING_STEP, Math.min(MAX_RATING_STEP, delta));
}

/**
 * Settles an online match for `uid` from the match record both players share.
 * A player who left before answering everything loses, whatever the score.
 */
export function settle(match, uid) {
  const oppUid = match.order.find((u) => u !== uid);
  const n = match.questions.length;
  const me = scoreFromRecord(match.questions, match.answers?.[uid]);
  const opp = scoreFromRecord(match.questions, match.answers?.[oppUid]);
  const oppForfeit = opp.answered < n && !match.presence?.[oppUid];
  let result;
  if (oppForfeit) result = 1;
  else result = me.score > opp.score ? 1 : me.score < opp.score ? 0 : 0.5;
  const ratings = { mine: match.players[uid].rating, theirs: match.players[oppUid].rating };
  return {
    myScore: me.score,
    opScore: opp.score,
    outcome: result === 1 ? 'win' : result === 0 ? 'loss' : 'draw',
    ratingChange: match.kind === 'friend' ? 0 : eloChange(ratings.mine, ratings.theirs, result),
    oppForfeit,
  };
}
