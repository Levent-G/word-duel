import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { shortMeaning } from '../data/dictionary';
import { colors, fonts } from '../theme';

/** One word in a list: tap opens it, star toggles favorite. `status` adds a ✓ / ✗ mark (match summary). */
export default function WordRow({ word, favorite, onPress, onToggleFavorite, status, last }) {
  return (
    <View style={[st.row, !last && st.divider]}>
      {status ? (
        <Feather
          name={status === 'correct' ? 'check' : 'x'}
          size={18}
          color={status === 'correct' ? colors.green : colors.red}
          style={{ marginRight: 12 }}
        />
      ) : null}
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [st.main, pressed && { opacity: 0.6 }]}
      >
        <Text style={st.en}>{word.en}</Text>
        <Text style={st.tr} numberOfLines={1}>
          {shortMeaning(word)}
        </Text>
      </Pressable>
      <Text style={st.level}>{word.l}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={favorite ? 'Favorilerden çıkar' : 'Favorilere ekle'}
        onPress={onToggleFavorite}
        style={st.star}
      >
        <MaterialCommunityIcons
          name={favorite ? 'star' : 'star-outline'}
          size={22}
          color={favorite ? colors.green : colors.faint}
        />
      </Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, paddingLeft: 16 },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.track },
  main: { flex: 1, paddingVertical: 14, gap: 2 },
  en: { fontFamily: fonts.semibold, fontSize: 17, color: colors.text },
  tr: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
  level: { fontFamily: fonts.semibold, fontSize: 12, color: colors.faint },
  star: { width: 52, height: 60, alignItems: 'center', justifyContent: 'center' },
});
