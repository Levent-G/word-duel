import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar, Card, IconTile, ListGroup, ListRow, Pill, XPBar, s as ui } from '../components/ui';
import { achievements } from '../game/achievements';
import { useNav } from '../nav';
import { onlineConfigured } from '../online/firebase';
import { levelInfo, streakStatus, useStore, wordStats } from '../store';
import { colors, fonts, shadow, space } from '../theme';

export default function ProfileScreen() {
  const nav = useNav();
  const { state } = useStore();
  const { profile } = state;
  const streak = streakStatus(state.streak);
  const lvl = levelInfo(profile.xp);
  const words = wordStats(state.words);
  const earned = achievements(state).filter((a) => a.done).length;

  const stats = [
    { icon: 'zap', tone: 'blue', label: 'Maç', value: profile.matches },
    { icon: 'award', tone: 'green', label: 'Galibiyet', value: profile.wins },
    { icon: 'book-open', tone: 'purple', label: 'Kelime', value: words.seen },
  ];

  const rows = [
    { icon: 'award', tone: 'green', title: 'Başarılarım', sub: `${earned} rozet`, to: 'achievements' },
    {
      icon: 'bar-chart-2',
      tone: 'orange',
      title: 'Sıralama',
      sub: onlineConfigured
        ? `${profile.onlineRating.toLocaleString('tr-TR')} online`
        : `${profile.rating.toLocaleString('tr-TR')} bot`,
      to: 'leaderboard',
    },
    { icon: 'target', tone: 'blue', title: 'Günlük Görevler', sub: `${streak.count} gün seri`, to: 'daily' },
    { icon: 'settings', tone: 'gray', title: 'Ayarlar', sub: state.settings.level, to: 'settings' },
  ];

  return (
    <ScrollView contentContainerStyle={st.screen} showsVerticalScrollIndicator={false}>
      <Text style={[ui.h1, { marginTop: 12 }]}>Profil</Text>

      <Card style={st.identity}>
        <View style={st.idRow}>
          <Avatar name={profile.name || 'Sen'} size={68} highlight />
          <View style={{ gap: 6, flex: 1 }}>
            <Text style={st.name} numberOfLines={1}>
              {profile.name || 'Oyuncu'}
            </Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <Pill text={`Seviye ${lvl.level}`} tone="green" icon="star" />
              <Pill text={`${streak.count} gün`} tone="orange" icon="trending-up" />
            </View>
          </View>
        </View>
        <XPBar label="Sonraki seviyeye" value={lvl.current} max={lvl.max} />
      </Card>

      <View style={st.stats}>
        {stats.map((s) => (
          <View key={s.label} style={st.stat}>
            <IconTile icon={s.icon} tone={s.tone} size={36} />
            <Text style={st.statValue}>{s.value.toLocaleString('tr-TR')}</Text>
            <Text style={[ui.rowSub, { fontSize: 12 }]}>{s.label}</Text>
          </View>
        ))}
      </View>

      <ListGroup>
        {rows.map((r, i) => (
          <ListRow
            key={r.to}
            icon={r.icon}
            tone={r.tone}
            title={r.title}
            right={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={ui.rowSub}>{r.sub}</Text>
                <Text style={st.chev}>›</Text>
              </View>
            }
            last={i === rows.length - 1}
            onPress={() => nav.go(r.to)}
          />
        ))}
      </ListGroup>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  screen: { paddingHorizontal: space.gutter, paddingBottom: 24, gap: 16 },
  identity: { gap: 18 },
  idRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  name: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.text },
  stats: { flexDirection: 'row', gap: 12 },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderRadius: 20,
    ...shadow,
  },
  statValue: { fontFamily: fonts.extrabold, fontSize: 20, color: colors.text, marginTop: 4 },
  chev: { fontFamily: fonts.medium, fontSize: 22, color: colors.faint, marginTop: -2 },
});
