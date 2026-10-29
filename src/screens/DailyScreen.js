import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ListGroup, PrimaryButton, ScreenHeader, XPBar, s as ui } from '../components/ui';
import { useNav } from '../nav';
import { playSound } from '../sounds';
import { dailyTasks, streakStatus, useStore } from '../store';
import { colors, fonts, space } from '../theme';

export default function DailyScreen() {
  const nav = useNav();
  const { state, claimTask } = useStore();
  const tasks = dailyTasks(state.daily);
  const streak = streakStatus(state.streak);
  const best = state.streak.best;
  let freezeText = 'Seri koruma hazır: bu hafta bir günü kaçırırsan serin bozulmaz.';
  if (streak.willFreeze) freezeText = 'Dünü kaçırdın. Bugün oynarsan seri koruma devreye girer ve serin sürer.';
  else if (!streak.freezeAvailable) freezeText = 'Bu haftanın seri koruması kullanıldı. Pazartesi yenilenir.';

  return (
    <View style={st.screen}>
      <ScreenHeader title="Günlük Görevler" onBack={nav.back} />

      <View style={st.streak}>
        <Text style={st.streakValue}>{streak.count}</Text>
        <Text style={ui.body}>günlük seri · en iyi {best} gün</Text>
        <View style={st.freeze}>
          <MaterialCommunityIcons
            name="snowflake"
            size={18}
            color={streak.freezeAvailable ? colors.blue : colors.faint}
          />
          <Text style={[ui.rowSub, { flex: 1, fontSize: 13 }]}>{freezeText}</Text>
        </View>
      </View>

      <ListGroup>
        {tasks.map((t, i) => (
          <View key={t.id} style={[st.row, i < tasks.length - 1 && st.divider]}>
            <Feather name={t.done ? 'check-circle' : t.icon} size={20} color={t.done ? colors.green : colors.muted} />
            <View style={{ flex: 1, gap: 8 }}>
              <View style={st.rowHead}>
                <Text style={st.title}>{t.title}</Text>
                <Text style={ui.rowSub}>
                  {t.progress} / {t.goal}
                </Text>
              </View>
              <XPBar compact value={t.progress} max={t.goal} />
            </View>
            {t.claimed ? (
              <Text style={st.claimed}>+{t.xp}</Text>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${t.xp} XP ödülü al`}
                disabled={!t.done}
                onPress={() => {
                  playSound('reward');
                  claimTask(t.id);
                }}
                style={[st.claim, t.done && st.claimReady]}
              >
                <Text style={[st.claimText, t.done && { color: '#FFFFFF' }]}>{t.xp} XP</Text>
              </Pressable>
            )}
          </View>
        ))}
      </ListGroup>

      <Text style={[ui.rowSub, { marginTop: 14 }]}>Görevler her gece yenilenir.</Text>

      <View style={{ flex: 1 }} />
      <PrimaryButton icon="zap" title="Düelloya Başla" onPress={() => nav.go('matchmaking')} />
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: space.gutter, paddingBottom: 24 },
  streak: { alignItems: 'center', gap: 4, marginTop: 24, marginBottom: 28 },
  streakValue: { fontFamily: fonts.extrabold, fontSize: 48, color: colors.text },
  freeze: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: colors.blueSoft,
    alignSelf: 'stretch',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between' },
  title: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  claim: {
    height: 36,
    minWidth: 64,
    paddingHorizontal: 10,
    borderRadius: 18,
    backgroundColor: colors.track,
    alignItems: 'center',
    justifyContent: 'center',
  },
  claimReady: { backgroundColor: colors.green },
  claimText: { fontFamily: fonts.bold, fontSize: 13, color: colors.muted },
  claimed: { minWidth: 64, textAlign: 'center', fontFamily: fonts.bold, fontSize: 13, color: colors.greenText },
});
