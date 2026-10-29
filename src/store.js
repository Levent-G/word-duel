import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, createElement, useContext, useEffect, useMemo, useReducer } from 'react';

import { todayKey } from './data/dictionary';

const STORAGE_KEY = 'wordduel:v1';

export const XP_PER_LEVEL = 500;

export const DAILY_TASKS = [
  { id: 'play', title: '3 düello oyna', goal: 3, key: 'played', xp: 30, icon: 'zap' },
  { id: 'win', title: '2 düello kazan', goal: 2, key: 'won', xp: 50, icon: 'award' },
  { id: 'correct', title: '25 doğru cevap ver', goal: 25, key: 'correct', xp: 40, icon: 'check-circle' },
];

/** Week keys of this week and the `n - 1` weeks before it. */
export function recentWeeks(n) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 7 * i);
    return weekKey(d);
  });
}

export function weekKey(d = new Date()) {
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return todayKey(monday);
}

const initialState = {
  loaded: false,
  profile: {
    name: '',
    xp: 0,
    rating: 1000,
    matches: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    perfect: 0,
    fast: 0,
    weekKey: weekKey(),
    weekPoints: 0,
    onlineRating: 1000,
    onlineMatches: 0,
    onlineWins: 0,
    leagueTier: 0,
    leagueNotice: null,
  },
  settings: { level: 'A2', haptics: true, autoSpeak: true, sounds: true, reminders: true },
  words: {},
  favorites: [],
  blocked: [],
  daily: { date: todayKey(), played: 0, won: 0, correct: 0, claimed: [] },
  streak: { last: null, count: 0, best: 0 },
};

function freshDaily(daily) {
  const today = todayKey();
  return daily.date === today ? daily : { date: today, played: 0, won: 0, correct: 0, claimed: [] };
}

function freshWeek(profile) {
  const wk = weekKey();
  return profile.weekKey === wk ? profile : { ...profile, weekKey: wk, weekPoints: 0 };
}

/** 'YYYY-MM-DD' as a local date (new Date('YYYY-MM-DD') would be UTC midnight). */
function parseDay(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function dayDiff(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

/** Streak after playing on `today`. One missed day per calendar week is forgiven (the "freeze"). */
export function nextStreak(streak, today = todayKey()) {
  if (streak.last === today) return streak;
  const gap = streak.last ? dayDiff(streak.last, today) : null;
  const week = weekKey(parseDay(today));
  let count = 1;
  let freezeWeek = streak.freezeWeek ?? null;
  let frozeOn = streak.frozeOn ?? null;
  if (gap === 1) count = streak.count + 1;
  else if (gap === 2 && streak.count > 0 && freezeWeek !== week) {
    count = streak.count + 1;
    freezeWeek = week;
    frozeOn = today;
  }
  return { last: today, count, best: Math.max(streak.best ?? 0, count), freezeWeek, frozeOn };
}

function reducer(state, action) {
  switch (action.type) {
    case 'load': {
      const saved = action.saved ?? {};
      return {
        ...initialState,
        ...saved,
        profile: freshWeek({ ...initialState.profile, ...saved.profile }),
        settings: { ...initialState.settings, ...saved.settings },
        daily: freshDaily({ ...initialState.daily, ...saved.daily }),
        streak: { ...initialState.streak, ...saved.streak },
        loaded: true,
      };
    }
    case 'setName':
      return { ...state, profile: { ...state.profile, name: action.name.trim() } };
    case 'setSettings':
      return { ...state, settings: { ...state.settings, ...action.patch } };
    case 'toggleFavorite': {
      const has = state.favorites.includes(action.id);
      return {
        ...state,
        favorites: has ? state.favorites.filter((f) => f !== action.id) : [action.id, ...state.favorites],
      };
    }
    case 'recordMatch': {
      const r = action.result;
      const now = Date.now();
      const words = { ...state.words };
      r.answers.forEach((a) => {
        const prev = words[a.wordId] ?? { c: 0, w: 0 };
        words[a.wordId] = {
          c: prev.c + (a.correct ? 1 : 0),
          w: prev.w + (a.correct ? 0 : 1),
          last: a.correct ? 1 : 0,
          t: now,
        };
      });

      const duel = r.mode === 'duel';
      const vsBot = duel && r.kind === 'bot';
      const p = freshWeek(state.profile);
      const profile = {
        ...p,
        xp: p.xp + r.xpEarned,
        rating: vsBot ? Math.max(0, p.rating + r.ratingChange) : p.rating,
        matches: p.matches + (duel ? 1 : 0),
        wins: p.wins + (duel && r.outcome === 'win' ? 1 : 0),
        losses: p.losses + (duel && r.outcome === 'loss' ? 1 : 0),
        draws: p.draws + (duel && r.outcome === 'draw' ? 1 : 0),
        perfect: p.perfect + (r.correct === r.total && r.total >= 10 ? 1 : 0),
        fast: p.fast + r.fastAnswers,
        weekPoints: p.weekPoints + (vsBot ? r.myScore : 0),
      };

      const d = freshDaily(state.daily);
      const daily = {
        ...d,
        played: d.played + (duel ? 1 : 0),
        won: d.won + (duel && r.outcome === 'win' ? 1 : 0),
        correct: d.correct + r.correct,
      };

      const today = todayKey();
      return { ...state, words, profile, daily, streak: nextStreak(state.streak, today) };
    }
    case 'setOnline':
      return { ...state, profile: { ...state.profile, ...action.patch } };
    case 'block':
      if (state.blocked.some((b) => b.uid === action.player.uid)) return state;
      return { ...state, blocked: [action.player, ...state.blocked].slice(0, 50) };
    case 'unblock':
      return { ...state, blocked: state.blocked.filter((b) => b.uid !== action.uid) };
    case 'wipe':
      return { ...initialState, loaded: true };
    case 'claimTask': {
      const task = DAILY_TASKS.find((t) => t.id === action.id);
      const d = freshDaily(state.daily);
      if (!task || d.claimed.includes(task.id) || d[task.key] < task.goal) return state;
      return {
        ...state,
        daily: { ...d, claimed: [...d.claimed, task.id] },
        profile: { ...state.profile, xp: state.profile.xp + task.xp },
      };
    }
    case 'reset':
      return { ...initialState, loaded: true, profile: { ...initialState.profile, name: state.profile.name } };
    default:
      return state;
  }
}

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => dispatch({ type: 'load', saved: raw ? JSON.parse(raw) : null }))
      .catch(() => dispatch({ type: 'load', saved: null }));
  }, []);

  useEffect(() => {
    if (!state.loaded) return;
    const { loaded, ...rest } = state;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(rest)).catch(() => {});
  }, [state]);

  const actions = useMemo(
    () => ({
      setName: (name) => dispatch({ type: 'setName', name }),
      setSettings: (patch) => dispatch({ type: 'setSettings', patch }),
      toggleFavorite: (id) => dispatch({ type: 'toggleFavorite', id }),
      recordMatch: (result) => dispatch({ type: 'recordMatch', result }),
      claimTask: (id) => dispatch({ type: 'claimTask', id }),
      setOnline: (patch) => dispatch({ type: 'setOnline', patch }),
      block: (player) => dispatch({ type: 'block', player }),
      unblock: (uid) => dispatch({ type: 'unblock', uid }),
      wipe: () => dispatch({ type: 'wipe' }),
      reset: () => dispatch({ type: 'reset' }),
    }),
    [],
  );

  const value = useMemo(() => ({ state, ...actions }), [state, actions]);
  return createElement(StoreContext.Provider, { value }, children);
}

export function useStore() {
  return useContext(StoreContext);
}

export function levelInfo(xp) {
  return { level: Math.floor(xp / XP_PER_LEVEL) + 1, current: xp % XP_PER_LEVEL, max: XP_PER_LEVEL };
}

/** A word is "to learn" while its latest answer was wrong; answering it right moves it out. */
export const isLearned = (entry) => !!entry && entry.last === 1;

export function wordStats(words) {
  let learned = 0;
  let toLearn = 0;
  for (const e of Object.values(words)) {
    if (isLearned(e)) learned++;
    else toLearn++;
  }
  return { seen: learned + toLearn, learned, toLearn };
}

/** Ids of words answered wrong last time: the review pool the word picker always considers. */
export function reviewIds(words) {
  return Object.entries(words)
    .filter(([, e]) => e.last === 0)
    .map(([id]) => id);
}

/**
 * What the streak looks like right now, before today's match is played:
 * count = streak that is still alive, atRisk = not played today yet,
 * freezeAvailable = this week's forgiven day is unused, willFreeze = yesterday was missed and the freeze will cover it.
 */
export function streakStatus(streak, today = todayKey()) {
  const freezeAvailable = streak.freezeWeek !== weekKey(parseDay(today));
  if (!streak.last) return { count: 0, atRisk: false, freezeAvailable, willFreeze: false, playedToday: false };
  const gap = dayDiff(streak.last, today);
  if (gap <= 0) return { count: streak.count, atRisk: false, freezeAvailable, willFreeze: false, playedToday: true };
  if (gap === 1) return { count: streak.count, atRisk: true, freezeAvailable, willFreeze: false, playedToday: false };
  if (gap === 2 && freezeAvailable && streak.count > 0) {
    return { count: streak.count, atRisk: true, freezeAvailable, willFreeze: true, playedToday: false };
  }
  return { count: 0, atRisk: false, freezeAvailable, willFreeze: false, playedToday: false };
}

export function dailyTasks(daily) {
  const d = freshDaily(daily);
  return DAILY_TASKS.map((t) => {
    const progress = Math.min(d[t.key], t.goal);
    return { ...t, progress, done: progress >= t.goal, claimed: d.claimed.includes(t.id) };
  });
}
