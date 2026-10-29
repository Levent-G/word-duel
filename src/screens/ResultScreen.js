import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import ReportSheet from '../components/ReportSheet';

import { Avatar, Card, IconTile, Pill, PrimaryButton, SecondaryButton, XPBar, s as ui } from '../components/ui';
import { matchStats } from '../game/stats';
import { useNav } from '../nav';
import { playSound } from '../sounds';
import { declineRematch, requestRematch, settleOnlineMatch, watchRematch } from '../online/api';
import { levelInfo, useStore, weekKey } from '../store';
import { colors, fonts, space, tones } from '../theme';

const OUTCOME = {
  win: { title: 'Kazandın!', sub: 'Harika bir maçtı.', icon: 'trophy', tone: 'green' },
  loss: { title: 'Kaybettin', sub: 'Bir dahaki sefere!', icon: 'emoticon-sad-outline', tone: 'red' },
  draw: { title: 'Berabere', sub: 'Kıl payı!', icon: 'handshake-outline', tone: 'orange' },
  practice: { title: 'Pratik tamamlandı', sub: 'Güzel çalışma.', icon: 'book-check-outline', tone: 'purple' },
};

/** Results whose sound and pop-in already played; coming back from the match summary stays quiet. */
const celebrated = new WeakSet();
/** Server-settled online results by match id, so the summary round trip does not settle twice. */
const settledMatches = new Map();
/** Open rematch requests by match id; they outlive the screen so a visit to the summary keeps them. */
const rematches = new Map();
const navHolder = { current: null };

const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '±0');

const seconds = (v) =>
  v === null ? '–' : `${v.toLocaleString('tr-TR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} sn`;

/** Rows of the head-to-head table. `better`: which direction wins the row. */
const COMPARE = [
  { label: 'Doğru cevap', get: (s) => s.correct, show: (s) => `${s.correct}/${s.total}`, better: 'high' },
  { label: 'Ort. cevap süresi', get: (s) => s.avgTime, show: (s) => seconds(s.avgTime), better: 'low' },
  { label: 'Hızlı cevap', get: (s) => s.fast, show: (s) => String(s.fast), better: 'high' },
  { label: 'En uzun seri', get: (s) => s.bestStreak, show: (s) => String(s.bestStreak), better: 'high' },
];

function winnerOf(row, mine, theirs) {
  const a = row.get(mine);
  const b = row.get(theirs);
  if (a === b) return null;
  if (a === null) return 'them';
  if (b === null) return 'me';
  const meBetter = row.better === 'high' ? a > b : a < b;
  return meBetter ? 'me' : 'them';
}

function Player({ name, label, score, lead, me, size }) {
  return (
    <View style={st.player}>
      <Avatar name={name} size={size} highlight={me} />
      <Text style={[ui.rowSub, { fontSize: 13 }]}>{label}</Text>
      <Text style={[st.score, lead && { color: colors.green }]}>{score}</Text>
    </View>
  );
}

function Stat({ icon, tone, value, label }) {
  return (
    <View style={st.stat}>
      <IconTile icon={icon} tone={tone} size={34} />
      <Text style={st.statValue}>{value}</Text>
      <Text style={[ui.rowSub, { fontSize: 12 }]}>{label}</Text>
    </View>
  );
}

export default function ResultScreen({ params }) {
  const nav = useNav();
  const { state, setOnline } = useStore();
  const { height } = useWindowDimensions();
  const compact = height < 720;
  const { result } = params;
  const duel = result.mode === 'duel';
  const lvl = levelInfo(state.profile.xp);
  const matchId = result.online?.matchId;
  const [server, setServer] = useState(() => (matchId ? settledMatches.get(matchId) ?? null : null));

  useEffect(() => {
    if (!matchId || settledMatches.has(matchId)) return undefined;
    let alive = true;
    // A short pause lets the last answers of both phones reach the database first.
    const t = setTimeout(() => {
      settleOnlineMatch(matchId, weekKey(), state.profile.name)
        .then((s) => {
          settledMatches.set(matchId, s);
          if (s.newRating != null) {
            setOnline({
              onlineRating: s.newRating,
              onlineMatches: state.profile.onlineMatches + (s.alreadySettled ? 0 : 1),
              onlineWins: state.profile.onlineWins + (!s.alreadySettled && s.outcome === 'win' ? 1 : 0),
              ...(s.tier != null ? { leagueTier: s.tier } : {}),
            });
          }
          if (alive) setServer(s);
        })
        .catch(() => alive && setServer({ failed: true }));
    }, 1200);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [matchId]); // eslint-disable-line react-hooks/exhaustive-deps

  const [reportOpen, setReportOpen] = useState(false);

  // ----- rematch -----
  navHolder.current = nav;
  const isOnline = !!matchId;
  const [rematch, setRematch] = useState(() => rematches.get(matchId)?.state ?? { mine: false, theirs: undefined });

  useEffect(() => {
    if (!isOnline) return undefined;
    const entry = rematches.get(matchId);
    if (entry) {
      entry.listener = setRematch;
      return () => {
        entry.listener = null;
      };
    }
    return watchRematch(matchId, (theirs) => setRematch((s) => ({ ...s, theirs })));
  }, [matchId]); // eslint-disable-line react-hooks/exhaustive-deps

  const rematchBlocked = isOnline && (rematch.theirs === false || result.oppLeft || rematch.failed);

  const askRematch = () => {
    if (!isOnline) {
      nav.replace('versus', { match: nav.startDuel(result.opponent) });
      return;
    }
    if (rematchBlocked || rematch.mine) return;
    const entry = { state: { ...rematch, mine: true }, listener: setRematch, cancel: null };
    rematches.set(matchId, entry);
    setRematch(entry.state);
    entry.cancel = requestRematch({
      matchId,
      me: nav.me,
      buildSpecs: nav.buildOnlineSpecs,
      onState: (s) => {
        entry.state = s;
        entry.listener?.(s);
      },
      onMatch: ({ matchId: next }) => {
        rematches.delete(matchId);
        playSound('found');
        navHolder.current?.replace('versus', { online: { matchId: next }, kind: result.kind });
      },
    });
  };

  const leaveRematch = () => {
    if (!isOnline) return;
    const entry = rematches.get(matchId);
    rematches.delete(matchId);
    if (entry?.cancel) entry.cancel();
    else declineRematch(matchId).catch(() => {});
  };

  let rematchNote = null;
  if (isOnline) {
    if (rematch.failed) rematchNote = 'Rövanş isteği gönderilemedi.';
    else if (rematch.theirs === false || result.oppLeft) rematchNote = 'Rakip ayrıldı, rövanş yapılamıyor.';
    else if (rematch.mine && rematch.theirs !== true) rematchNote = 'Rövanş isteği gönderildi, rakip bekleniyor…';
    else if (rematch.theirs === true && !rematch.mine) rematchNote = `${result.opponent.name.split(' ')[0]} rövanş istiyor!`;
    else if (rematch.mine && rematch.theirs === true) rematchNote = 'Yeni maç hazırlanıyor…';
  }

  const settled = server && !server.failed ? server : null;
  const outcome = settled?.outcome ?? result.outcome;
  const myScore = settled?.myScore ?? result.myScore;
  const opScore = settled?.opScore ?? result.opScore;
  const o = OUTCOME[outcome];

  let ratingPill = null;
  if (result.kind === 'bot') {
    ratingPill = { text: `Bot puanı ${signed(result.ratingChange)} · ${state.profile.rating.toLocaleString('tr-TR')}`, tone: 'gray', icon: 'cpu' };
  } else if (result.kind === 'friend') {
    ratingPill = { text: 'Arkadaş maçı · puana sayılmaz', tone: 'gray', icon: 'users' };
  } else if (result.kind === 'online') {
    if (server?.failed) ratingPill = { text: 'Online puan kaydedilemedi', tone: 'red', icon: 'wifi-off' };
    else if (!settled) ratingPill = { text: 'Online puan hesaplanıyor…', tone: 'gray', icon: 'loader' };
    else
      ratingPill = {
        text: `Online puan ${signed(settled.ratingChange)} · ${settled.newRating.toLocaleString('tr-TR')}`,
        tone: settled.ratingChange >= 0 ? 'green' : 'red',
        icon: 'globe',
      };
  }
  const myName = state.profile.name || 'Sen';
  const mine = matchStats(result.answers);
  const theirs = matchStats(result.opAnswers);
  const firstView = !celebrated.has(result);
  const pop = useRef(new Animated.Value(firstView ? 0.4 : 1)).current;
  const badge = compact ? 56 : 72;

  useEffect(() => {
    if (celebrated.has(result)) return;
    celebrated.add(result);
    Animated.spring(pop, { toValue: 1, friction: 4, useNativeDriver: true }).start();
    playSound({ win: 'win', loss: 'lose', draw: 'draw', practice: 'win' }[result.outcome]);
  }, [pop, result]);

  return (
    <View style={[st.screen, { paddingTop: compact ? 8 : 20 }]}>
      <View style={st.top}>
        <Animated.View
          style={[
            st.badge,
            { width: badge, height: badge, borderRadius: badge * 0.34, backgroundColor: tones[o.tone][0] },
            { transform: [{ scale: pop }] },
          ]}
        >
          <MaterialCommunityIcons name={o.icon} size={badge * 0.5} color={tones[o.tone][1]} />
        </Animated.View>
        <Text style={[ui.h1, { fontSize: compact ? 26 : 30, textAlign: 'center' }]}>{o.title}</Text>
        <Text style={[ui.body, { textAlign: 'center', fontSize: 15 }]}>
          {result.oppLeft || settled?.oppForfeit ? 'Rakibin maçtan ayrıldı.' : o.sub}
        </Text>
        {ratingPill ? <Pill {...ratingPill} style={{ alignSelf: 'center', marginTop: 2 }} /> : null}
        <View style={st.xpRow}>
          <Pill text={`+${result.xpEarned} XP`} tone="purple" icon="star" />
          <View style={{ flex: 1 }}>
            <XPBar compact value={lvl.current} max={lvl.max} />
          </View>
          <Text style={st.xpLevel}>Sv. {lvl.level}</Text>
        </View>
      </View>

      <View style={st.middle}>
        {duel ? (
          <Card style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 0, paddingVertical: compact ? 12 : 18 }}>
            <View style={[st.scores, { paddingBottom: compact ? 10 : 16 }]}>
              <Player
                name={myName}
                label="Sen"
                score={myScore}
                lead={myScore > opScore}
                me
                size={compact ? 44 : 56}
              />
              <View style={st.vs}>
                <Text style={st.vsText}>VS</Text>
              </View>
              <Player
                name={result.opponent.name}
                label={result.opponent.name.split(' ')[0]}
                score={opScore}
                lead={opScore > myScore}
                size={compact ? 44 : 56}
              />
            </View>
            {COMPARE.map((row) => {
              const w = winnerOf(row, mine, theirs);
              return (
                <View key={row.label} style={[st.cmpRow, { minHeight: compact ? 34 : 40 }]}>
                  <Text style={[st.cmpValue, w === 'me' && st.cmpWin]}>{row.show(mine)}</Text>
                  <Text style={st.cmpLabel}>{row.label}</Text>
                  <Text style={[st.cmpValue, { textAlign: 'right' }, w === 'them' && st.cmpWin]}>
                    {row.show(theirs)}
                  </Text>
                </View>
              );
            })}
          </Card>
        ) : (
          <View style={{ gap: 14 }}>
            <Card style={st.scores}>
              <Player name={myName} label="Puanın" score={result.myScore} me size={compact ? 40 : 48} />
            </Card>
            <View style={st.stats}>
              <Stat icon="check-circle" tone="green" value={`${result.correct}/${result.total}`} label="Doğru" />
              <Stat icon="clock" tone="blue" value={seconds(mine.avgTime)} label="Ort. süre" />
              <Stat icon="zap" tone="orange" value={result.fastAnswers} label="Hızlı cevap" />
            </View>
          </View>
        )}
      </View>

      <View style={st.actions}>
        {duel ? (
          <>
            {rematchNote ? <Text style={[st.rematchNote, rematch.theirs === true && !rematch.mine && st.rematchHot]}>{rematchNote}</Text> : null}
            <View style={st.row}>
              <View style={{ flex: 1, opacity: rematchBlocked || rematch.mine ? 0.55 : 1 }}>
                <PrimaryButton
                  icon="repeat"
                  title={rematch.theirs === true && !rematch.mine ? 'Kabul Et' : rematch.mine ? 'Bekleniyor' : 'Rövanş'}
                  onPress={askRematch}
                />
              </View>
              <SecondaryButton
                style={{ flex: 1, height: 56 }}
                icon="zap"
                title="Yeni Rakip"
                onPress={() => {
                  leaveRematch();
                  if (result.kind === 'friend') nav.replace('friend');
                  else nav.replace('matchmaking', { kind: result.kind === 'online' ? 'online' : 'bot' });
                }}
              />
            </View>
          </>
        ) : (
          <PrimaryButton icon="rotate-cw" title="Tekrar Oyna" onPress={() => nav.startPractice(undefined, 'replace')} />
        )}
        {isOnline ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setReportOpen(true)}
            hitSlop={8}
            style={st.reportLink}
          >
            <Feather name="flag" size={13} color={colors.muted} />
            <Text style={st.reportText}>Rakibi bildir veya engelle</Text>
          </Pressable>
        ) : null}
        <View style={st.row}>
          <SecondaryButton style={{ flex: 1 }} icon="list" title="Maç Özeti" onPress={() => nav.go('summary', { result })} />
          <SecondaryButton
            style={{ flex: 1 }}
            icon="home"
            title="Ana Sayfa"
            onPress={() => {
              leaveRematch();
              nav.reset('home');
            }}
          />
        </View>
      </View>
      <ReportSheet
        player={reportOpen && isOnline ? { uid: result.online.oppUid, name: result.opponent.name } : null}
        matchId={matchId}
        onClose={() => setReportOpen(false)}
      />
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: space.gutter, paddingBottom: 16 },
  top: { alignItems: 'center', gap: 6 },
  badge: { alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  xpRow: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'stretch', marginTop: 8, paddingHorizontal: 8 },
  xpLevel: { fontFamily: fonts.bold, fontSize: 13, color: colors.muted },
  middle: { flex: 1, justifyContent: 'center', paddingVertical: 16 },
  scores: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  player: { alignItems: 'center', gap: 2, minWidth: 100 },
  score: { fontFamily: fonts.extrabold, fontSize: 30, color: colors.text, fontVariant: ['tabular-nums'] },
  vs: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center' },
  vsText: { fontFamily: fonts.extrabold, fontSize: 11, color: '#FFFFFF' },
  cmpRow: {
    flex: 1,
    maxHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: colors.track,
  },
  cmpValue: { width: 80, fontFamily: fonts.bold, fontSize: 17, color: colors.muted, fontVariant: ['tabular-nums'] },
  cmpWin: { color: colors.greenText },
  cmpLabel: { flex: 1, textAlign: 'center', fontFamily: fonts.medium, fontSize: 14, color: colors.muted },
  stats: { flexDirection: 'row', gap: 12 },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderRadius: 20,
    shadowColor: '#202B3C',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  statValue: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.text, marginTop: 2 },
  actions: { gap: 10 },
  reportLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  reportText: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  rematchNote: { fontFamily: fonts.semibold, fontSize: 13, color: colors.muted, textAlign: 'center' },
  rematchHot: { color: colors.greenText, fontFamily: fonts.bold },
  row: { flexDirection: 'row', gap: 10 },
});
