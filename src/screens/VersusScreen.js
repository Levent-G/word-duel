import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { Avatar, Pill, PrimaryButton, s as ui } from '../components/ui';
import { hydrateQuestions } from '../game/questions';
import { displayName } from '../moderation';
import { enterMatch, leaveMatch, listenMatch } from '../online/api';
import { useNav } from '../nav';
import { playSound } from '../sounds';
import { levelInfo, useStore } from '../store';
import { colors, fonts, shadow, space } from '../theme';

const CONNECT_TIMEOUT_MS = 15000;

function PlayerRow({ name, title, rating, me, from, enter }) {
  return (
    <Animated.View
      style={[st.row, me ? st.rowMe : st.rowThem, { opacity: enter, transform: [{ translateX: from }] }]}
    >
      <Avatar name={name} size={60} highlight={me} ring={me ? undefined : colors.track} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={st.role}>{me ? 'SEN' : 'RAKİP'}</Text>
        <Text style={st.name} numberOfLines={1}>
          {title}
        </Text>
      </View>
      <View style={st.ratingBox}>
        <Text style={[st.rating, me && { color: colors.greenText }]}>{rating.toLocaleString('tr-TR')}</Text>
        <Text style={st.ratingLabel}>puan</Text>
      </View>
    </Animated.View>
  );
}

/** Loads an online match and waits until both players are connected. */
function useOnlineMatch(online, kind, words) {
  const [match, setMatch] = useState(null);
  const [failed, setFailed] = useState(false);
  const wordsRef = useRef(words);

  useEffect(() => {
    if (!online) return undefined;
    let unsub = () => {};
    let built = null;
    let alive = true;
    const timer = setTimeout(() => alive && !built?.ready && setFailed(true), CONNECT_TIMEOUT_MS);

    enterMatch(online.matchId)
      .then((uid) => {
        unsub = listenMatch(online.matchId, (val) => {
          if (!alive || !val?.questions || !val.players) return;
          const oppUid = val.order.find((u) => u !== uid);
          if (!built) {
            built = {
              mode: 'duel',
              kind: kind ?? 'online',
              online: { matchId: online.matchId, uid, oppUid },
              opponent: { ...val.players[oppUid], name: displayName(val.players[oppUid]?.name) },
              myRating: val.players[uid]?.rating,
              questions: hydrateQuestions(val.questions, (id) => wordsRef.current[id]),
            };
          }
          if (val.presence?.[oppUid] && val.presence?.[uid] && !built.ready) {
            built.ready = true;
            setMatch(built);
          }
        });
      })
      .catch(() => alive && setFailed(true));

    return () => {
      alive = false;
      clearTimeout(timer);
      unsub();
    };
  }, [online]); // eslint-disable-line react-hooks/exhaustive-deps

  return { match, failed };
}

export default function VersusScreen({ params }) {
  const nav = useNav();
  const { state } = useStore();
  const onlineState = useOnlineMatch(params.online ?? null, params.kind, state.words);
  const match = params.match ?? onlineState.match;
  const ready = !!match;

  const [count, setCount] = useState(3);
  const pop = useRef(new Animated.Value(1)).current;
  const enter = useRef(new Animated.Value(0)).current;
  const navRef = useRef(nav);
  navRef.current = nav;
  const myName = state.profile.name || 'Sen';

  useEffect(() => {
    if (!ready) return;
    Animated.timing(enter, { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [enter, ready]);

  useEffect(() => {
    if (!ready) return undefined;
    if (count === 0) {
      playSound('go');
      navRef.current.replace('game', { match });
      return undefined;
    }
    if (count < 3) playSound('tick');
    pop.setValue(0.7);
    Animated.spring(pop, { toValue: 1, friction: 4, useNativeDriver: true }).start();
    const t = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [count, pop, match, ready]);

  if (onlineState.failed && !ready) {
    return (
      <View style={[st.screen, { justifyContent: 'center', gap: 16 }]}>
        <Text style={[ui.h1, { textAlign: 'center' }]}>Rakip bağlanamadı</Text>
        <Text style={[ui.body, { textAlign: 'center' }]}>Bağlantı kurulamadı. Yeniden rakip arayabilirsin.</Text>
        <PrimaryButton
          icon="refresh-cw"
          title="Yeniden Ara"
          onPress={() => {
            leaveMatch();
            nav.replace('matchmaking', { kind: 'online' });
          }}
        />
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={[st.screen, { justifyContent: 'center', alignItems: 'center', gap: 10 }]}>
        <Text style={st.headline}>Rakip bağlanıyor…</Text>
        <Text style={ui.body}>Maç hazırlanıyor</Text>
      </View>
    );
  }

  const fromLeft = enter.interpolate({ inputRange: [0, 1], outputRange: [-80, 0] });
  const fromRight = enter.interpolate({ inputRange: [0, 1], outputRange: [80, 0] });
  const vsScale = enter.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1.2, 1] });

  return (
    <View style={st.screen}>
      <View style={st.top}>
        <Pill
          text={match.kind === 'bot' ? 'BOTA KARŞI' : 'CANLI DÜELLO'}
          tone={match.kind === 'bot' ? 'purple' : 'red'}
          icon={match.kind === 'bot' ? 'cpu' : 'radio'}
          style={{ alignSelf: 'center' }}
        />
        <Text style={st.headline}>Rakibin hazır</Text>
      </View>

      <View style={st.center}>
        <View style={st.players}>
          <PlayerRow
            name={match.opponent.name}
            title={match.opponent.name}
            rating={match.opponent.rating}
            from={fromRight}
            enter={enter}
          />
          <Animated.View style={[st.vs, { transform: [{ scale: vsScale }] }]}>
            <Text style={st.vsText}>VS</Text>
          </Animated.View>
          <PlayerRow
            name={myName}
            title={`${myName} · Sv. ${levelInfo(state.profile.xp).level}`}
            rating={match.kind === 'bot' ? state.profile.rating : match.myRating ?? state.profile.onlineRating}
            me
            from={fromLeft}
            enter={enter}
          />
        </View>

        <View style={st.countWrap}>
          <Animated.View style={[st.count, { transform: [{ scale: pop }] }]}>
            <Text style={st.countText}>{Math.max(count, 1)}</Text>
          </Animated.View>
          <Text style={st.starting}>Maç başlıyor</Text>
          <View style={st.pills}>
            <Pill text="10 soru" tone="purple" icon="list" />
            <Pill text="10 sn / soru" tone="blue" icon="clock" />
            <Pill text={state.settings.level} tone="gray" icon="book-open" />
          </View>
        </View>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: space.gutter, paddingVertical: 24 },
  center: { flex: 1, justifyContent: 'center', gap: 40 },
  top: { alignItems: 'center', gap: 10, marginTop: 8 },
  headline: { fontFamily: fonts.extrabold, fontSize: 26, color: colors.text, letterSpacing: -0.5 },
  players: { gap: 0, alignItems: 'stretch' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 24,
    ...shadow,
  },
  rowThem: { backgroundColor: colors.surface },
  rowMe: { backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.green },
  role: { fontFamily: fonts.bold, fontSize: 11, color: colors.muted, letterSpacing: 1.5 },
  name: { fontFamily: fonts.bold, fontSize: 18, color: colors.text },
  ratingBox: { alignItems: 'flex-end', minWidth: 64 },
  rating: { fontFamily: fonts.extrabold, fontSize: 20, color: colors.text, fontVariant: ['tabular-nums'] },
  ratingLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  vs: {
    alignSelf: 'center',
    width: 52,
    height: 52,
    borderRadius: 26,
    marginVertical: -14,
    zIndex: 2,
    elevation: 6,
    backgroundColor: colors.text,
    borderWidth: 4,
    borderColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vsText: { fontFamily: fonts.extrabold, fontSize: 15, color: '#FFFFFF' },
  countWrap: { alignItems: 'center', gap: 14 },
  count: {
    width: 116,
    height: 116,
    borderRadius: 58,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.green,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  countText: { fontFamily: fonts.extrabold, fontSize: 56, color: '#FFFFFF', fontVariant: ['tabular-nums'] },
  starting: { fontFamily: fonts.semibold, fontSize: 16, color: colors.muted },
  pills: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
});
