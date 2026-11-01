import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { LogoMark } from './src/components/Logo';
import { BottomNav, FadeIn } from './src/components/ui';
import { getWord } from './src/data/dictionary';
import { botHistory } from './src/game/bots';
import { buildQuestions, serializeQuestions } from './src/game/questions';
import ConnectionBanner from './src/components/ConnectionBanner';
import { scheduleReminders } from './src/notifications';
import { fetchMyRating, syncLeague, syncProfile } from './src/online/api';
import { onlineConfigured } from './src/online/firebase';
import { NavContext } from './src/nav';
import AchievementsScreen from './src/screens/AchievementsScreen';
import DailyScreen from './src/screens/DailyScreen';
import FriendScreen from './src/screens/FriendScreen';
import GameScreen from './src/screens/GameScreen';
import HomeScreen from './src/screens/HomeScreen';
import LeaderboardScreen from './src/screens/LeaderboardScreen';
import MatchmakingScreen from './src/screens/MatchmakingScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import ResultScreen from './src/screens/ResultScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import SummaryScreen from './src/screens/SummaryScreen';
import VersusScreen from './src/screens/VersusScreen';
import WordDetailScreen from './src/screens/WordDetailScreen';
import WordsScreen from './src/screens/WordsScreen';
import { preloadSounds, setHapticsEnabled, setSoundEnabled } from './src/sounds';
import { StoreProvider, dailyTasks, reviewIds, useStore, weekKey } from './src/store';
import { colors } from './src/theme';

const SCREENS = {
  home: HomeScreen,
  words: WordsScreen,
  profile: ProfileScreen,
  matchmaking: MatchmakingScreen,
  versus: VersusScreen,
  game: GameScreen,
  result: ResultScreen,
  summary: SummaryScreen,
  wordDetail: WordDetailScreen,
  leaderboard: LeaderboardScreen,
  daily: DailyScreen,
  achievements: AchievementsScreen,
  friend: FriendScreen,
  settings: SettingsScreen,
};

const TABS = ['home', 'words', 'profile'];

function Splash() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
      <LogoMark size={96} />
    </View>
  );
}
const DUEL_QUESTIONS = 10;
const PRACTICE_QUESTIONS = 5;

function Root() {
  const { state, recordMatch, setOnline } = useStore();
  const [stack, setStack] = useState([{ name: 'home' }]);
  const route = stack[stack.length - 1];

  useEffect(() => {
    setSoundEnabled(state.settings.sounds);
  }, [state.settings.sounds]);

  useEffect(() => {
    setHapticsEnabled(state.settings.haptics);
  }, [state.settings.haptics]);

  useEffect(() => {
    preloadSounds();
  }, []);

  const go = useCallback((name, params) => setStack((s) => [...s, { name, params }]), []);
  const replace = useCallback((name, params) => setStack((s) => [...s.slice(0, -1), { name, params }]), []);
  const reset = useCallback((name, params) => setStack([{ name, params }]), []);
  const back = useCallback(
    () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s[0].name === 'home' ? s : [{ name: 'home' }])),
    [],
  );

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (['game', 'versus'].includes(route.name)) return true;
      if (route.name === 'result') {
        reset('home');
        return true;
      }
      if (stack.length === 1 && route.name === 'home') return false;
      back();
      return true;
    });
    return () => sub.remove();
  }, [route.name, stack.length, back, reset]);

  const flows = useMemo(
    () => ({
      startDuel: (opponent) => {
        const mine = (id) => state.words[id];
        const theirs = opponent.history ?? botHistory(opponent, (id) => getWord(id)?.l);
        const questions = buildQuestions({
          count: DUEL_QUESTIONS,
          level: state.settings.level,
          histories: [mine, theirs],
          reviewIds: reviewIds(state.words),
        });
        return { mode: 'duel', kind: 'bot', opponent, questions };
      },
      /** Question builder handed to the online host once the guest's history is known. */
      buildOnlineSpecs: (guestHistory, dv) =>
        serializeQuestions(
          buildQuestions({
            count: DUEL_QUESTIONS,
            level: state.settings.level,
            histories: [(id) => state.words[id], guestHistory],
            reviewIds: reviewIds(state.words),
            dv,
          }),
        ),
      me: {
        name: state.profile.name || 'Oyuncu',
        rating: state.profile.onlineRating,
        blocked: state.blocked.map((b) => b.uid),
      },
      startPractice: (firstId, how = 'go') => {
        const questions = buildQuestions({
          count: PRACTICE_QUESTIONS,
          level: state.settings.level,
          histories: [(id) => state.words[id]],
          reviewIds: reviewIds(state.words),
          firstId,
        });
        (how === 'replace' ? replace : go)('game', { match: { mode: 'practice', opponent: null, questions } });
      },
      finishMatch: (r) => {
        const duel = r.mode === 'duel';
        const outcome = !duel ? 'practice' : r.myScore > r.opScore ? 'win' : r.myScore < r.opScore ? 'loss' : 'draw';
        const xpEarned = duel
          ? { win: 50, draw: 30, loss: 20 }[outcome] + r.correct * 5
          : r.correct * 5;
        // Bot matches move the local bot rating; online ratings are settled from the server record on the result screen.
        const ratingChange = r.kind === 'bot' ? { win: 18, draw: 2, loss: -12 }[outcome] : 0;
        const result = { ...r, outcome, xpEarned, ratingChange };
        recordMatch(result);
        replace('result', { result });
      },
    }),
    [state.settings.level, state.words, state.profile.name, state.profile.onlineRating, state.blocked, go, replace, recordMatch],
  );

  // Keep the server copy of the profile and word history fresh for matchmaking.
  const { name } = state.profile;
  useEffect(() => {
    if (!onlineConfigured || !state.loaded || !name) return undefined;
    const t = setTimeout(() => {
      syncProfile({ name, level: state.settings.level }, state.words).catch(() => {});
    }, 1500);
    return () => clearTimeout(t);
  }, [state.loaded, name, state.settings.level, state.words]);

  // The server is the source of truth for the online rating (e.g. after reinstalling) and the league.
  useEffect(() => {
    if (!onlineConfigured || !state.loaded) return;
    fetchMyRating()
      .then((v) => setOnline({ onlineRating: v.rating, onlineMatches: v.matches, onlineWins: v.wins }))
      .catch(() => {});
    syncLeague(weekKey())
      .then(({ tier, change }) => setOnline({ leagueTier: tier, ...(change ? { leagueNotice: { tier, change } } : {}) }))
      .catch(() => {});
  }, [state.loaded, setOnline]);

  // Local reminders follow progress: rescheduled when the day's play, tasks or the setting change.
  const reminderKey = [
    state.settings.reminders,
    state.profile.name,
    state.streak.last,
    state.daily.date,
    dailyTasks(state.daily).filter((t) => t.done).length,
  ].join('|');
  useEffect(() => {
    if (!state.loaded) return undefined;
    const t = setTimeout(() => scheduleReminders(state).catch(() => {}), 1000);
    return () => clearTimeout(t);
  }, [state.loaded, reminderKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const nav = useMemo(
    () => ({ route, go, replace, back, reset, ...flows }),
    [route, go, replace, back, reset, flows],
  );

  if (!state.loaded) return <Splash />;

  const Screen = SCREENS[route.name];
  const isTab = TABS.includes(route.name) && stack.length === 1;

  return (
    <NavContext.Provider value={nav}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={isTab ? ['top'] : ['top', 'bottom']}>
        <ConnectionBanner />
        <FadeIn key={`${stack.length}-${route.name}`}>
          <Screen params={route.params ?? {}} />
        </FadeIn>
        {isTab ? <BottomNav active={route.name} onChange={(t) => reset(t)} /> : null}
      </SafeAreaView>
    </NavContext.Provider>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  if (!fontsLoaded) return <Splash />;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <StoreProvider>
        <Root />
      </StoreProvider>
    </SafeAreaProvider>
  );
}
