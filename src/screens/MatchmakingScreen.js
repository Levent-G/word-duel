import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { Avatar, Pill, PrimaryButton, SecondaryButton, s as ui } from '../components/ui';
import { findOpponent } from '../game/bots';
import { joinQueue } from '../online/api';
import { onlineConfigured } from '../online/firebase';
import { useNav } from '../nav';
import { playSound, startLoop, stopLoop } from '../sounds';
import { useStore } from '../store';
import { colors, fonts } from '../theme';

const BOT_OFFER_AFTER = 20;

function Pulse({ delay }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration: 2400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, delay]);
  return (
    <Animated.View
      style={[
        st.pulse,
        {
          opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
          transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 2.2] }) }],
        },
      ]}
    />
  );
}

/** params.kind: 'online' (Firebase lobby) or 'bot'. params.opponent: a fixed bot (simulated friend room). */
export default function MatchmakingScreen({ params }) {
  const nav = useNav();
  const { state } = useStore();
  const kind = params.kind ?? (onlineConfigured ? 'online' : 'bot');
  const online = kind === 'online';
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState(null);
  const latest = useRef({ nav, rating: state.profile.rating });
  latest.current = { nav, rating: state.profile.rating };

  useEffect(() => {
    if (online && !onlineConfigured) return undefined;
    startLoop('search');
    const tick = setInterval(() => setSeconds((s) => s + 1), 1000);
    let cancel = () => {};

    if (online) {
      const n = latest.current.nav;
      cancel = joinQueue({
        level: state.settings.level,
        me: n.me,
        buildSpecs: n.buildOnlineSpecs,
        onMatch: ({ matchId }) => {
          stopLoop();
          playSound('found');
          latest.current.nav.replace('versus', { online: { matchId }, kind: 'online' });
        },
        onError: (e) => setError(e?.message ?? 'Bağlantı hatası'),
      });
    } else {
      const t = setTimeout(
        () => {
          const { nav: n, rating } = latest.current;
          const opponent = params.opponent ?? findOpponent(rating);
          stopLoop();
          playSound('found');
          n.replace('versus', { match: n.startDuel(opponent) });
        },
        params.opponent ? 2500 : 2200 + Math.random() * 1800,
      );
      cancel = () => clearTimeout(t);
    }

    return () => {
      stopLoop();
      clearInterval(tick);
      cancel();
    };
  }, [online, params.opponent]); // eslint-disable-line react-hooks/exhaustive-deps

  if (online && !onlineConfigured) {
    return (
      <View style={st.screen}>
        <View style={st.center}>
          <Text style={st.title}>Online mod kapalı</Text>
          <Text style={[ui.body, { textAlign: 'center' }]}>
            Online düello için Firebase ayarlarının girilmesi gerekiyor. O zamana kadar botlara karşı oynayabilirsin.
          </Text>
        </View>
        <View style={st.actions}>
          <PrimaryButton icon="cpu" title="Bota Karşı Oyna" onPress={() => nav.replace('matchmaking', { kind: 'bot' })} />
          <SecondaryButton title="Geri" onPress={nav.back} />
        </View>
      </View>
    );
  }

  const title = params.title ?? (online ? 'Online rakip aranıyor…' : 'Bot rakip aranıyor…');
  const subtitle =
    params.subtitle ?? (online ? `${state.settings.level} seviyesindeki oyuncular` : 'Seviyene yakın bir bot hazırlanıyor');

  return (
    <View style={st.screen}>
      <View style={st.center}>
        <View style={st.radar}>
          <Pulse delay={0} />
          <Pulse delay={800} />
          <Pulse delay={1600} />
          <Avatar name={state.profile.name || 'Sen'} size={96} highlight />
        </View>
        <Text style={st.title}>{title}</Text>
        <Text style={[ui.body, { textAlign: 'center' }]}>{subtitle}</Text>
        <View style={st.pills}>
          <Pill text={online ? 'Online' : 'Bot'} tone={online ? 'green' : 'purple'} icon={online ? 'globe' : 'cpu'} />
          <Pill text="10 soru" tone="blue" icon="list" />
          <Pill text={`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`} tone="gray" icon="clock" />
        </View>
        {error ? <Text style={st.error}>{error}</Text> : null}
      </View>
      <View style={st.actions}>
        {online && (seconds >= BOT_OFFER_AFTER || error) ? (
          <PrimaryButton icon="cpu" title="Bota Karşı Oyna" onPress={() => nav.replace('matchmaking', { kind: 'bot' })} />
        ) : null}
        <SecondaryButton title="İptal" icon="x" onPress={nav.back} />
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', paddingBottom: 24, paddingHorizontal: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  radar: { width: 220, height: 220, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  pulse: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: colors.green,
  },
  title: { fontFamily: fonts.extrabold, fontSize: 24, color: colors.text, textAlign: 'center' },
  pills: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' },
  error: { fontFamily: fonts.semibold, fontSize: 13, color: colors.redText, textAlign: 'center', marginTop: 8 },
  actions: { alignSelf: 'stretch', gap: 10 },
});
