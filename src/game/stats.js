/** Per-player match stats from a list of { correct, time } answers (time is null when the clock ran out). */
export function matchStats(answers = []) {
  const answered = answers.filter((a) => a.time !== null && a.time !== undefined);
  let streak = 0;
  let bestStreak = 0;
  for (const a of answers) {
    streak = a.correct ? streak + 1 : 0;
    bestStreak = Math.max(bestStreak, streak);
  }
  return {
    correct: answers.filter((a) => a.correct).length,
    total: answers.length,
    fast: answers.filter((a) => a.fast).length,
    avgTime: answered.length ? answered.reduce((s, a) => s + a.time, 0) / answered.length : null,
    bestStreak,
    missed: answers.length - answered.length,
  };
}
