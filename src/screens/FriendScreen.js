import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Share, StyleSheet, Text, TextInput, View } from 'react-native';

import { Pill, PrimaryButton, ScreenHeader, SecondaryButton, Segmented, s as ui } from '../components/ui';
import { createRoom, joinRoom } from '../online/api';
import { onlineConfigured } from '../online/firebase';
import { useNav } from '../nav';
import { playSound } from '../sounds';
import { useStore } from '../store';
import { colors, fonts, radius, shadow, space } from '../theme';

const MODES = [
  { key: 'create', label: 'Oda Kur' },
  { key: 'join', label: 'Odaya Katıl' },
];

const normaliseCode = (t) => {
  const digits = t.replace(/\D/g, '').slice(0, 4);
  return digits ? `WD-${digits}` : '';
};

export default function FriendScreen() {
  const nav = useNav();
  const { state } = useStore();
  const [mode, setMode] = useState('create');
  const [code, setCode] = useState('');
  const [room, setRoom] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const cancelRef = useRef(null);
  const navRef = useRef(nav);
  navRef.current = nav;
  const demoCode = useMemo(() => `WD-${Math.floor(1000 + Math.random() * 9000)}`, []);
  const validJoin = /^WD-\d{4}$/.test(code);

  const onMatch = ({ matchId }) => {
    cancelRef.current = null;
    playSound('found');
    navRef.current.replace('versus', { online: { matchId }, kind: 'friend' });
  };

  useEffect(() => () => cancelRef.current?.(), []);

  useEffect(() => {
    cancelRef.current?.();
    cancelRef.current = null;
    setRoom(null);
    setError(null);
    setBusy(false);
  }, [mode]);

  const openRoom = async () => {
    setError(null);
    if (!onlineConfigured) {
      nav.go('matchmaking', {
        kind: 'bot',
        opponent: { name: 'Arkadaşın', rating: state.profile.rating },
        title: 'Arkadaşın bekleniyor…',
        subtitle: `Oda kodu: ${demoCode} · deneme modu`,
      });
      return;
    }
    setBusy(true);
    try {
      const r = await createRoom({
        me: nav.me,
        level: state.settings.level,
        buildSpecs: nav.buildOnlineSpecs,
        onMatch,
        onError: (e) => setError(e?.message ?? 'Oda açılamadı'),
      });
      cancelRef.current = r.cancel;
      setRoom(r.code);
    } catch (e) {
      setError(e?.message ?? 'Oda açılamadı');
    } finally {
      setBusy(false);
    }
  };

  const join = async () => {
    if (!validJoin) return;
    setError(null);
    if (!onlineConfigured) {
      nav.go('matchmaking', {
        kind: 'bot',
        opponent: { name: 'Oda Sahibi', rating: state.profile.rating },
        title: 'Odaya bağlanılıyor…',
        subtitle: 'Deneme modu',
      });
      return;
    }
    setBusy(true);
    try {
      cancelRef.current = await joinRoom({ code, me: nav.me, onMatch });
    } catch (e) {
      setError(e?.message ?? 'Odaya katılınamadı');
      setBusy(false);
    }
  };

  const share = (c) =>
    Share.share({ message: `Word Duel'de benimle düello yap! Oda kodu: ${c}` }).catch(() => {});

  return (
    <View style={st.screen}>
      <ScreenHeader title="Arkadaşınla Oyna" onBack={nav.back} />
      <View style={{ marginTop: 16 }}>
        <Segmented items={MODES} value={mode} onChange={setMode} />
      </View>

      {!onlineConfigured ? (
        <Pill text="Deneme modu: online ayarlanınca gerçek oda açılır" tone="orange" icon="info" style={{ marginTop: 14 }} />
      ) : null}

      {mode === 'create' ? (
        <View style={st.body}>
          {room ? (
            <>
              <Text style={ui.body}>Bu kodu arkadaşına gönder. Katıldığı an maç başlar.</Text>
              <View style={st.codeBox}>
                <Text style={st.code}>{room}</Text>
              </View>
              <View style={st.waiting}>
                <ActivityIndicator color={colors.green} />
                <Text style={ui.rowSub}>Arkadaşın bekleniyor…</Text>
              </View>
              <SecondaryButton icon="share-2" title="Kodu Paylaş" onPress={() => share(room)} />
            </>
          ) : (
            <Text style={ui.body}>Bir oda aç, sana bir kod verelim. Arkadaşın bu kodla odana katılsın.</Text>
          )}
        </View>
      ) : (
        <View style={st.body}>
          <Text style={ui.body}>Arkadaşının gönderdiği oda kodunu yaz.</Text>
          <TextInput
            value={code}
            onChangeText={(t) => setCode(normaliseCode(t))}
            placeholder="WD-1234"
            placeholderTextColor={colors.faint}
            accessibilityLabel="Oda kodu"
            keyboardType="number-pad"
            maxLength={7}
            editable={!busy}
            style={st.input}
          />
          {busy ? (
            <View style={st.waiting}>
              <ActivityIndicator color={colors.green} />
              <Text style={ui.rowSub}>Oda sahibi maçı hazırlıyor…</Text>
            </View>
          ) : null}
        </View>
      )}

      {error ? <Text style={st.error}>{error}</Text> : null}

      <View style={{ flex: 1 }} />
      {mode === 'create' ? (
        room ? null : (
          <View style={{ opacity: busy ? 0.6 : 1 }}>
            <PrimaryButton icon="plus" title={busy ? 'Oda açılıyor…' : 'Oda Aç'} onPress={() => !busy && openRoom()} />
          </View>
        )
      ) : (
        <View style={{ opacity: validJoin && !busy ? 1 : 0.5 }}>
          <PrimaryButton icon="log-in" title="Katıl" onPress={() => !busy && join()} />
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: space.gutter, paddingBottom: 24 },
  body: { marginTop: 28, gap: 18 },
  codeBox: {
    height: 96,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  code: { fontFamily: fonts.extrabold, fontSize: 36, letterSpacing: 4, color: colors.text },
  waiting: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  input: {
    height: 64,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    textAlign: 'center',
    fontFamily: fonts.bold,
    fontSize: 26,
    letterSpacing: 3,
    color: colors.text,
    ...shadow,
  },
  error: { fontFamily: fonts.semibold, fontSize: 14, color: colors.redText, textAlign: 'center', marginTop: 16 },
});
