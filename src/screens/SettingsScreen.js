import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Logo } from '../components/Logo';
import {
  ListGroup,
  ListRow,
  NameModal,
  ScreenHeader,
  SecondaryButton,
  SimpleModal,
  SwitchRow,
  s as ui,
} from '../components/ui';
import { PRIVACY_URL, SUPPORT_URL } from '../config';
import { LEVELS, WORDS_BY_LEVEL } from '../data/dictionary';
import { useNav } from '../nav';
import { ensureReminderPermission } from '../notifications';
import { deleteAccount } from '../online/api';
import { onlineConfigured } from '../online/firebase';
import { recentWeeks, useStore } from '../store';
import { colors, fonts, radius, shadowSoft, space } from '../theme';

const LEVEL_NAMES = {
  A1: 'Başlangıç',
  A2: 'Temel',
  B1: 'Orta',
  B2: 'Orta üstü',
  C1: 'İleri',
  C2: 'Uzman',
};

export default function SettingsScreen() {
  const nav = useNav();
  const { state, setSettings, setName, reset, unblock, wipe } = useStore();
  const [nameOpen, setNameOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [denied, setDenied] = useState(false);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const { settings, profile } = state;

  const deleteEverything = async () => {
    if (deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      if (onlineConfigured) await deleteAccount(recentWeeks(12));
      await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
      setDeleteOpen(false);
      wipe();
      nav.reset('home');
    } catch {
      setDeleteError('Silinemedi. İnternet bağlantını kontrol edip tekrar dene.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <View style={st.screen}>
      <ScreenHeader title="Ayarlar" onBack={nav.back} />
      <ScrollView contentContainerStyle={{ paddingTop: 20, paddingBottom: 24, gap: 28 }} showsVerticalScrollIndicator={false}>
        <View style={{ gap: 10 }}>
          <Text style={st.section}>Kelime seviyesi</Text>
          <View style={st.levels}>
            {LEVELS.map((l) => {
              const on = settings.level === l;
              return (
                <Pressable
                  key={l}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  onPress={() => setSettings({ level: l })}
                  style={[st.level, on && st.levelOn]}
                >
                  <Text style={[st.levelCode, on && { color: colors.greenText }]}>{l}</Text>
                  <Text style={[ui.rowSub, { fontSize: 12 }]}>{LEVEL_NAMES[l]}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={ui.rowSub}>
            Sorular {settings.level} seviyesindeki {WORDS_BY_LEVEL[settings.level].length.toLocaleString('tr-TR')} kelimeden
            gelir.
          </Text>
        </View>

        <View style={{ gap: 10 }}>
          <Text style={st.section}>Hesap</Text>
          <ListGroup>
            <ListRow icon="user" tone="green" title="Adın" subtitle={profile.name} onPress={() => setNameOpen(true)} />
            <SwitchRow
              icon="bell"
              tone="green"
              title="Hatırlatmalar"
              value={settings.reminders}
              onChange={async (v) => {
                if (v && !(await ensureReminderPermission().catch(() => false))) {
                  setDenied(true);
                  return;
                }
                setSettings({ reminders: v });
              }}
            />
            <SwitchRow
              icon="music"
              tone="orange"
              title="Ses efektleri"
              value={settings.sounds}
              onChange={(v) => setSettings({ sounds: v })}
            />
            <SwitchRow
              icon="volume-2"
              tone="blue"
              title="Kelimeleri sesli oku"
              value={settings.autoSpeak}
              onChange={(v) => setSettings({ autoSpeak: v })}
            />
            <SwitchRow
              icon="smartphone"
              tone="purple"
              title="Titreşim"
              value={settings.haptics}
              onChange={(v) => setSettings({ haptics: v })}
              last
            />
          </ListGroup>
        </View>

        <View style={{ gap: 10 }}>
          <Text style={st.section}>Gizlilik ve güvenlik</Text>
          <ListGroup>
            {onlineConfigured ? (
              <ListRow
                icon="slash"
                tone="gray"
                title="Engellenen oyuncular"
                subtitle={state.blocked.length ? `${state.blocked.length} oyuncu` : 'Kimse engellenmedi'}
                onPress={() => setBlockedOpen(true)}
              />
            ) : null}
            <ListRow icon="shield" tone="blue" title="Gizlilik Politikası" onPress={() => Linking.openURL(PRIVACY_URL)} />
            <ListRow icon="life-buoy" tone="green" title="Destek ve iletişim" onPress={() => Linking.openURL(SUPPORT_URL)} last />
          </ListGroup>
        </View>

        <ListGroup>
          <ListRow
            icon="rotate-ccw"
            tone="orange"
            title="İlerlemeyi sıfırla"
            subtitle="XP, kelimeler ve görevler"
            onPress={() => setResetOpen(true)}
            right={null}
          />
          <ListRow
            icon="trash-2"
            tone="red"
            title="Hesabımı ve verilerimi sil"
            subtitle="Sunucudaki tüm verilerin dahil"
            onPress={() => setDeleteOpen(true)}
            right={null}
            last
          />
        </ListGroup>

        <View style={{ alignItems: 'center', gap: 6, marginTop: 8 }}>
          <Logo size={28} />
          <Text style={[ui.rowSub, { fontSize: 12 }]}>Sürüm {Constants.expoConfig?.version ?? '1.0.0'}</Text>
        </View>
      </ScrollView>

      <NameModal
        visible={nameOpen}
        title="Adını değiştir"
        initial={profile.name}
        onSubmit={(n) => {
          setName(n);
          setNameOpen(false);
        }}
        onClose={() => setNameOpen(false)}
      />
      <SimpleModal
        visible={denied}
        icon="bell-off"
        tone="orange"
        title="Bildirim izni kapalı"
        message="Hatırlatmalar için telefonun Ayarlar › Bildirimler bölümünden bu uygulamaya izin vermen gerekiyor."
        onClose={() => setDenied(false)}
      />
      <SimpleModal
        visible={resetOpen}
        title="İlerleme sıfırlansın mı?"
        message="XP, kelimeler, favoriler ve görevler silinir. Bu işlem geri alınamaz."
        primary={{ title: 'Vazgeç', onPress: () => setResetOpen(false) }}
        secondary={{
          title: 'Sıfırla',
          onPress: () => {
            reset();
            setResetOpen(false);
          },
        }}
        onClose={() => setResetOpen(false)}
      />
      <SimpleModal
        visible={deleteOpen}
        icon="trash-2"
        tone="red"
        title="Hesabın silinsin mi?"
        message={
          deleteError ??
          'Adın, online puanın, lig ve sıralama kayıtların, kelime geçmişin ve bu telefondaki tüm ilerlemen kalıcı olarak silinir. Bu işlem geri alınamaz.'
        }
        primary={{ title: 'Vazgeç', onPress: () => setDeleteOpen(false) }}
        secondary={{ title: deleting ? 'Siliniyor…' : 'Hesabımı Sil', onPress: deleteEverything }}
        onClose={() => !deleting && setDeleteOpen(false)}
      />
      <Modal visible={blockedOpen} transparent animationType="fade" onRequestClose={() => setBlockedOpen(false)}>
        <Pressable style={ui.backdrop} onPress={() => setBlockedOpen(false)}>
          <Pressable style={ui.modal} onPress={() => {}}>
            <Text style={ui.modalTitle}>Engellenen oyuncular</Text>
            {state.blocked.length ? (
              state.blocked.map((b) => (
                <View key={b.uid} style={st.blockedRow}>
                  <Text style={[ui.rowTitle, { flex: 1 }]} numberOfLines={1}>
                    {b.name}
                  </Text>
                  <Pressable accessibilityRole="button" onPress={() => unblock(b.uid)} hitSlop={8} style={st.unblock}>
                    <Text style={st.unblockText}>Engeli kaldır</Text>
                  </Pressable>
                </View>
              ))
            ) : (
              <Text style={ui.modalText}>Engellediğin oyuncularla eşleşmezsin. Şu an kimse engelli değil.</Text>
            )}
            <SecondaryButton title="Kapat" onPress={() => setBlockedOpen(false)} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: space.gutter },
  section: { fontFamily: fonts.semibold, fontSize: 13, color: colors.muted },
  blockedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  unblock: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: colors.track },
  unblockText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  levels: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  level: {
    width: '31%',
    flexGrow: 1,
    height: 64,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.surface,
    backgroundColor: colors.surface,
    ...shadowSoft,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  levelOn: { borderColor: colors.green, borderWidth: 1.5, backgroundColor: colors.greenSoft },
  levelCode: { fontFamily: fonts.bold, fontSize: 17, color: colors.text },
});
