import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  Avatar,
  Bouncy,
  Card,
  IconTile,
  NameModal,
  Pill,
  PrimaryButton,
  SimpleModal,
  XPBar,
  s as ui,
} from '../components/ui';
import { Logo } from '../components/Logo';
import { shortMeaning, wordOfDay } from '../data/dictionary';
import { useNav } from '../nav';
import { onlineConfigured } from '../online/firebase';
import { speak } from '../speech';
import { LEAGUES } from '../online/api';
import { dailyTasks, levelInfo, streakStatus, useStore, wordStats } from '../store';
import { colors, fonts, radius, shadow, space } from '../theme';

function Tile({ icon, tone, title, subtitle, onPress, badge }) {
  return (
    <Bouncy accessibilityRole="button" onPress={onPress} style={st.tile} containerStyle={st.tileWrap}>
      <View style={st.tileTop}>
        <IconTile icon={icon} tone={tone} size={40} />
        {badge ? <View style={st.badge} /> : null}
      </View>
      <Text style={st.tileTitle} numberOfLines={1}>
        {title}
      </Text>
      <Text style={ui.rowSub} numberOfLines={1}>
        {subtitle}
      </Text>
    </Bouncy>
  );
}

export default function HomeScreen() {
  const { state, setName, setOnline } = useStore();
  const nav = useNav();
  const { profile, settings } = state;
  const streak = streakStatus(state.streak);
  const league = LEAGUES[profile.leagueTier ?? 0];
  const notice = profile.leagueNotice;
  const lvl = levelInfo(profile.xp);
  const word = wordOfDay(settings.level);
  const tasks = dailyTasks(state.daily);
  const tasksDone = tasks.filter((t) => t.done).length;
  const unclaimed = tasks.some((t) => t.done && !t.claimed);
  const toLearn = wordStats(state.words).toLearn;
  const firstName = profile.name.split(' ')[0];

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>
        <View style={st.topBar}>
          <Logo size={36} />
          <View style={st.topRight}>
            <View
              style={[st.streak, streak.atRisk && st.streakRisk]}
              accessibilityLabel={`${streak.count} günlük seri${streak.atRisk ? ', bugün oynamazsan bozulur' : ''}`}
            >
              <MaterialCommunityIcons
                name={streak.willFreeze ? 'snowflake' : 'fire'}
                size={18}
                color={streak.willFreeze ? colors.blue : streak.count ? colors.orange : colors.faint}
              />
              <Text style={[st.streakText, !streak.count && { color: colors.muted }]}>{streak.count}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Profil" onPress={() => nav.reset('profile')}>
              <Avatar name={profile.name || 'Sen'} size={38} highlight />
            </Pressable>
          </View>
        </View>

        <View style={{ gap: 4 }}>
          <Text style={st.name} numberOfLines={1}>
            Merhaba{firstName ? `, ${firstName}` : ''}
          </Text>
          <Text style={ui.rowSub}>Bugün kimi yeneceksin?</Text>
        </View>

        <View style={st.hero}>
          <View style={[st.circle, { width: 220, height: 220, top: -90, right: -70 }]} />
          <View style={[st.circle, { width: 120, height: 120, bottom: -50, left: -30 }]} />
          <View style={st.heroTop}>
            <View style={{ gap: 2 }}>
              <Text style={st.heroLabel}>
                Seviye {lvl.level} · {onlineConfigured ? 'Online puan' : 'Bot puanı'}
              </Text>
              <Text style={st.heroValue}>
                {(onlineConfigured ? profile.onlineRating : profile.rating).toLocaleString('tr-TR')} puan
              </Text>
            </View>
            <View style={st.heroIcon}>
              <MaterialCommunityIcons name="sword-cross" size={26} color="#FFFFFF" />
            </View>
          </View>
          <XPBar light value={lvl.current} max={lvl.max} label="Sonraki seviye" />
          <View style={{ gap: 10 }}>
            <PrimaryButton
              variant="white"
              large
              icon="globe"
              title="Online Düello"
              onPress={() => nav.go('matchmaking', { kind: 'online' })}
            />
            <Bouncy
              accessibilityRole="button"
              onPress={() => nav.go('matchmaking', { kind: 'bot' })}
              style={st.botBtn}
            >
              <Feather name="cpu" size={18} color="#FFFFFF" />
              <Text style={st.botText}>Bota Karşı Oyna</Text>
            </Bouncy>
          </View>
        </View>

        <View style={st.grid}>
          <Tile icon="users" tone="blue" title="Arkadaşınla" subtitle="Oda kur veya katıl" onPress={() => nav.go('friend')} />
          <Tile
            icon="book-open"
            tone="purple"
            title="Pratik Yap"
            subtitle={toLearn ? `${toLearn} kelime tekrar` : '5 hızlı soru'}
            onPress={() => nav.startPractice()}
          />
          <Tile
            icon="target"
            tone="green"
            title="Günlük Görev"
            subtitle={unclaimed ? 'Ödülün hazır' : `${tasksDone} / ${tasks.length} tamamlandı`}
            badge={unclaimed}
            onPress={() => nav.go('daily')}
          />
          <Tile
            icon="bar-chart-2"
            tone="orange"
            title="Sıralama"
            subtitle={onlineConfigured ? `${league.name} Lig` : 'Haftanın liderleri'}
            onPress={() => nav.go('leaderboard')}
          />
        </View>

        <Card style={st.wotd}>
          <View style={st.wotdHead}>
            <Pill text="Günün kelimesi" tone="green" icon="sun" />
            <Pill text={word.l} tone="gray" />
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => nav.go('wordDetail', { id: word.id })}
            style={st.wotdBody}
          >
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={st.wotdWord}>{word.en}</Text>
              <Text style={ui.rowSub} numberOfLines={1}>
                {shortMeaning(word)}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Kelimeyi dinle"
              onPress={() => speak(word.en)}
              hitSlop={6}
              style={st.speak}
            >
              <Feather name="volume-2" size={18} color={colors.green} />
            </Pressable>
          </Pressable>
        </Card>
      </ScrollView>

      <NameModal visible={!profile.name} title="Word Duel'e hoş geldin! Adın ne?" onSubmit={setName} logo />
      <SimpleModal
        visible={!!notice && !!profile.name}
        icon={notice?.change > 0 ? 'trending-up' : 'trending-down'}
        tone={notice?.change > 0 ? 'green' : 'orange'}
        title={
          notice?.change > 0
            ? `Tebrikler! ${LEAGUES[notice.tier].name} Lig'e yükseldin`
            : `${LEAGUES[notice?.tier ?? 0].name} Lig'e düştün`
        }
        message={
          notice?.change > 0
            ? 'Geçen haftayı ligindeki ilk 10 içinde bitirdin. Bu hafta daha güçlü rakipler seni bekliyor.'
            : 'Geçen hafta ligindeki son 5 içinde kaldın. Bu hafta kazanıp geri dönebilirsin.'
        }
        primary={{
          title: 'Ligi Gör',
          onPress: () => {
            setOnline({ leagueNotice: null });
            nav.go('leaderboard');
          },
        }}
        secondary={{ title: 'Kapat', onPress: () => setOnline({ leagueNotice: null }) }}
        onClose={() => setOnline({ leagueNotice: null })}
      />
    </View>
  );
}

const st = StyleSheet.create({
  scroll: { paddingHorizontal: space.gutter, paddingTop: 12, paddingBottom: 24, gap: 18 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { fontFamily: fonts.extrabold, fontSize: 26, color: colors.text, letterSpacing: -0.5 },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: colors.orangeSoft,
  },
  streakText: { fontFamily: fonts.extrabold, fontSize: 14, color: colors.orange },
  streakRisk: { borderWidth: 1.5, borderColor: colors.orange },
  hero: {
    backgroundColor: colors.green,
    borderRadius: 26,
    padding: 20,
    gap: 18,
    overflow: 'hidden',
    ...shadow,
    shadowColor: colors.green,
    shadowOpacity: 0.3,
  },
  circle: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.1)' },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroLabel: { fontFamily: fonts.semibold, fontSize: 14, color: 'rgba(255,255,255,0.85)' },
  heroValue: { fontFamily: fonts.extrabold, fontSize: 28, color: '#FFFFFF', letterSpacing: -0.5 },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  botBtn: {
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  botText: { fontFamily: fonts.bold, fontSize: 15, color: '#FFFFFF' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tileWrap: { flexBasis: '46%', flexGrow: 1, minWidth: 140 },
  tile: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 16,
    gap: 4,
    ...shadow,
  },
  tileTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  tileTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  badge: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.orange },
  wotd: { gap: 12 },
  wotdHead: { flexDirection: 'row', justifyContent: 'space-between' },
  wotdBody: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  wotdWord: { fontFamily: fonts.extrabold, fontSize: 24, color: colors.text, letterSpacing: -0.3 },
  speak: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
