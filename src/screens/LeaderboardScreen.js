import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import ReportSheet from '../components/ReportSheet';

import { Avatar, Pill, ScreenHeader, Segmented, s as ui } from '../components/ui';
import { leaderboard } from '../game/bots';
import { DEMOTE_BOTTOM, LEAGUES, PROMOTE_TOP, fetchLeaderboard, fetchLeague } from '../online/api';
import { onlineConfigured } from '../online/firebase';
import { useNav } from '../nav';
import { useStore, weekKey } from '../store';
import { colors, fonts, radius, space } from '../theme';

const MEDALS = [
  ['#FFF1C7', '#B07A00'],
  ['#EDF1F5', '#5B6576'],
  ['#FBE5D6', '#A65A24'],
];

const BOARDS = [
  { key: 'online', label: 'Online' },
  { key: 'bot', label: 'Botlar' },
];

const PERIODS = [
  { key: 'week', label: 'Bu Hafta' },
  { key: 'all', label: 'Tüm Zamanlar' },
];

export default function LeaderboardScreen() {
  const nav = useNav();
  const { state } = useStore();
  const [board, setBoard] = useState(onlineConfigured ? 'online' : 'bot');
  const [period, setPeriod] = useState('week');
  const { profile } = state;

  const [remote, setRemote] = useState({ period: null, rows: null, failed: false });

  useEffect(() => {
    if (!onlineConfigured || board !== 'online') return undefined;
    let alive = true;
    setRemote({ period, rows: null, failed: false });
    (period === 'week' ? fetchLeague(weekKey(), profile.leagueTier ?? 0) : fetchLeaderboard(period, weekKey()))
      .then((rows) => alive && setRemote({ period, rows, failed: false }))
      .catch(() => alive && setRemote({ period, rows: null, failed: true }));
    return () => {
      alive = false;
    };
  }, [board, period, profile.onlineRating, profile.leagueTier]);
  const league = LEAGUES[profile.leagueTier ?? 0];
  const isLeague = board === 'online' && period === 'week';

  const botRows = useMemo(
    () =>
      leaderboard(
        { name: profile.name || 'Sen', rating: profile.rating, weekPoints: profile.weekPoints },
        period,
        weekKey(),
      ),
    [profile.name, profile.rating, profile.weekPoints, period],
  );
  const online = board === 'online';
  const offline = online && !onlineConfigured;
  const loading = online && onlineConfigured && !remote.rows && !remote.failed;
  const [reportTarget, setReportTarget] = useState(null);
  const blockedIds = new Set(state.blocked.map((b) => b.uid));
  const rows = (online ? remote.rows ?? [] : botRows).map((row) =>
    row.uid && blockedIds.has(row.uid) ? { ...row, name: 'Engellenen oyuncu' } : row,
  );
  const me = rows.find((r) => r.me);
  const kindWord = online ? 'online düellolarda' : 'bot maçlarında';

  let note;
  if (offline) note = 'Online mod henüz ayarlanmadı.';
  else if (loading) note = 'Sıralama yükleniyor…';
  else if (online && remote.failed) note = 'Sıralama yüklenemedi. İnternet bağlantını kontrol et.';
  else if (!rows.length) note = 'Henüz kimse puan almadı. İlk sen ol!';
  else if (!me) note = `İlk 50 içinde değilsin · ${kindWord} kazanarak yüksel`;
  else if (isLeague) note = `${me.rank}. sıradasın · ilk ${PROMOTE_TOP} yükselir, son ${DEMOTE_BOTTOM} düşer`;
  else if (period === 'week') note = `Bu hafta ${me.rank}. sıradasın · ${kindWord} kazandığın puanlar`;
  else note = `${me.rank}. sıradasın · ${online ? 'online' : 'bot'} puanına göre`;

  return (
    <View style={st.screen}>
      <ScreenHeader title="Sıralama" onBack={nav.back} />
      <View style={{ marginTop: 16, gap: 10 }}>
        <Segmented items={BOARDS} value={board} onChange={setBoard} />
        <Segmented items={PERIODS} value={period} onChange={setPeriod} />
      </View>
      <View style={st.noteRow}>
        {isLeague ? (
          <View style={[st.leaguePill, { backgroundColor: league.soft }]}>
            <MaterialCommunityIcons name="shield-star" size={14} color={league.color} />
            <Text style={[st.leagueText, { color: league.color }]}>{league.name} Lig</Text>
          </View>
        ) : (
          <Pill text={online ? 'Online' : 'Botlar'} tone={online ? 'green' : 'purple'} icon={online ? 'globe' : 'cpu'} />
        )}
        <Text style={[ui.rowSub, { flex: 1 }]}>{note}</Text>
      </View>
      {loading ? <ActivityIndicator color={colors.green} style={{ marginTop: 24 }} /> : null}

      <FlatList
        data={rows}
        keyExtractor={(r) => String(r.rank)}
        style={{ marginTop: 12 }}
        contentContainerStyle={st.list}
        renderItem={({ item, index }) => (
          <Pressable
            disabled={!online || item.me || !item.uid}
            onLongPress={() => setReportTarget({ uid: item.uid, name: item.name })}
            accessibilityHint={online && !item.me ? 'Bildirmek veya engellemek için basılı tut' : undefined}
            style={({ pressed }) => [
              st.row,
              index < rows.length - 1 && st.divider,
              item.me && { backgroundColor: colors.greenSoft },
              pressed && { backgroundColor: colors.bg },
            ]}
          >
            {item.rank <= 3 ? (
              <View style={[st.medal, { backgroundColor: MEDALS[item.rank - 1][0] }]}>
                <Text style={[st.medalText, { color: MEDALS[item.rank - 1][1] }]}>{item.rank}</Text>
              </View>
            ) : (
              <Text style={st.rank}>{item.rank}</Text>
            )}
            <Avatar name={item.name} size={36} highlight={item.me} />
            <Text style={[st.name, item.me && { fontFamily: fonts.bold }]} numberOfLines={1}>
              {item.me ? `${item.name} (Sen)` : item.name}
            </Text>
            <Text style={st.value}>{item.value.toLocaleString('tr-TR')}</Text>
            {isLeague ? (
              <Feather
                name={item.zone === 'up' ? 'chevrons-up' : item.zone === 'down' ? 'chevrons-down' : 'minus'}
                size={16}
                color={item.zone === 'up' ? colors.green : item.zone === 'down' ? colors.red : colors.track}
                accessibilityLabel={item.zone === 'up' ? 'Yükselme bölgesi' : item.zone === 'down' ? 'Düşme bölgesi' : undefined}
              />
            ) : null}
          </Pressable>
        )}
      />
      {online && rows.length > 1 ? (
        <Text style={st.hint}>Bir oyuncuyu bildirmek ya da engellemek için adına basılı tut.</Text>
      ) : null}
      <ReportSheet player={reportTarget} onClose={() => setReportTarget(null)} />
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: space.gutter },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  hint: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, textAlign: 'center', marginBottom: 16 },
  leaguePill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  leagueText: { fontFamily: fonts.bold, fontSize: 12 },
  list: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    overflow: 'hidden',
    marginBottom: 24,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, height: 62 },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.track },
  rank: { width: 28, fontFamily: fonts.bold, fontSize: 15, color: colors.muted, textAlign: 'center' },
  medal: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  medalText: { fontFamily: fonts.extrabold, fontSize: 13 },
  name: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  value: { fontFamily: fonts.bold, fontSize: 15, color: colors.text, fontVariant: ['tabular-nums'] },
});
