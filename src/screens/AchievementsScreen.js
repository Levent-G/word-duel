import { Feather } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ListGroup, ScreenHeader, XPBar, s as ui } from '../components/ui';
import { achievements } from '../game/achievements';
import { useNav } from '../nav';
import { useStore } from '../store';
import { colors, fonts, space } from '../theme';

export default function AchievementsScreen() {
  const nav = useNav();
  const { state } = useStore();
  const list = achievements(state);
  const done = list.filter((a) => a.done).length;

  return (
    <View style={st.screen}>
      <ScreenHeader title="Başarılarım" onBack={nav.back} />
      <ScrollView contentContainerStyle={{ paddingTop: 16, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <Text style={[ui.body, { marginBottom: 16 }]}>
          {list.length} rozetten {done} tanesini kazandın.
        </Text>
        <ListGroup>
          {list.map((a, i) => (
            <View key={a.id} style={[st.row, i < list.length - 1 && st.divider]}>
              <View style={[st.icon, a.done && { backgroundColor: colors.greenSoft }]}>
                <Feather name={a.icon} size={20} color={a.done ? colors.green : colors.faint} />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <View style={st.head}>
                  <Text style={[st.title, !a.done && { color: colors.text }]}>{a.title}</Text>
                  {a.done ? (
                    <Feather name="check" size={16} color={colors.green} />
                  ) : (
                    <Text style={ui.rowSub}>
                      {a.value} / {a.goal}
                    </Text>
                  )}
                </View>
                <Text style={ui.rowSub}>{a.desc}</Text>
                {a.done ? null : <XPBar compact value={a.value} max={a.goal} />}
              </View>
            </View>
          ))}
        </ListGroup>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: space.gutter },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, padding: 16 },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.track,
    alignItems: 'center',
    justifyContent: 'center',
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
});
