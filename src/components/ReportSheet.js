import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { REPORT_REASONS, reportPlayer } from '../online/api';
import { useStore } from '../store';
import { colors, fonts, radius } from '../theme';
import { IconTile, PrimaryButton, SecondaryButton, s as ui } from './ui';

/** Report and/or block another online player. `player` = { uid, name }. */
export default function ReportSheet({ player, matchId, onClose }) {
  const { state, block } = useStore();
  const [reason, setReason] = useState(null);
  const [blockToo, setBlockToo] = useState(true);
  const [sent, setSent] = useState(false);
  const alreadyBlocked = !!player && state.blocked.some((b) => b.uid === player.uid);

  useEffect(() => {
    setReason(null);
    setBlockToo(true);
    setSent(false);
  }, [player?.uid]);

  const submit = async () => {
    if (!reason && !blockToo) return;
    if (reason) await reportPlayer(player.uid, reason, matchId).catch(() => {});
    if (blockToo && !alreadyBlocked) block({ uid: player.uid, name: player.name });
    setSent(true);
  };

  return (
    <Modal visible={!!player} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={ui.backdrop} onPress={onClose}>
        <Pressable style={ui.modal} onPress={() => {}}>
          {sent ? (
            <>
              <IconTile icon="check" tone="green" size={48} />
              <Text style={ui.modalTitle}>Teşekkürler</Text>
              <Text style={ui.modalText}>
                {reason ? 'Bildirimin alındı ve incelenecek. ' : ''}
                {blockToo ? `${player?.name} ile artık eşleşmeyeceksin.` : ''}
              </Text>
              <SecondaryButton title="Kapat" onPress={onClose} />
            </>
          ) : (
            <>
              <IconTile icon="flag" tone="red" size={48} />
              <Text style={ui.modalTitle}>{player?.name}</Text>
              <Text style={ui.modalText}>Bu oyuncuyu neden bildiriyorsun?</Text>
              <View style={{ gap: 8 }}>
                {REPORT_REASONS.map((r) => {
                  const on = reason === r.key;
                  return (
                    <Pressable
                      key={r.key}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      onPress={() => setReason(on ? null : r.key)}
                      style={[st.reason, on && st.reasonOn]}
                    >
                      <Text style={[st.reasonText, on && { color: colors.redText }]}>{r.label}</Text>
                      {on ? <Feather name="check" size={18} color={colors.red} /> : null}
                    </Pressable>
                  );
                })}
              </View>
              <View style={st.blockRow}>
                <Text style={[ui.rowTitle, { flex: 1, fontSize: 15 }]}>
                  {alreadyBlocked ? 'Zaten engelli' : 'Bu oyuncuyu engelle'}
                </Text>
                <Switch
                  value={alreadyBlocked || blockToo}
                  disabled={alreadyBlocked}
                  onValueChange={setBlockToo}
                  trackColor={{ false: colors.track, true: colors.red }}
                  thumbColor="#FFFFFF"
                />
              </View>
              <View style={{ opacity: reason || (blockToo && !alreadyBlocked) ? 1 : 0.5 }}>
                <PrimaryButton title={reason ? 'Bildir' : 'Engelle'} onPress={submit} />
              </View>
              <SecondaryButton title="Vazgeç" onPress={onClose} />
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const st = StyleSheet.create({
  reason: {
    height: 46,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reasonOn: { borderColor: colors.red, backgroundColor: colors.redSoft },
  reasonText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  blockRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
});
