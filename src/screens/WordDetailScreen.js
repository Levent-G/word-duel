import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { IconButton, Pill, PrimaryButton, s as ui } from '../components/ui';
import { getWord } from '../data/dictionary';
import { useNav } from '../nav';
import { speak } from '../speech';
import { isLearned, useStore } from '../store';
import { colors, fonts, shadowSoft, space } from '../theme';

export default function WordDetailScreen({ params }) {
  const nav = useNav();
  const { state, toggleFavorite } = useStore();
  const word = getWord(params.id);
  const favorite = state.favorites.includes(word.id);
  const entry = state.words[word.id];

  let status = null;
  if (entry) status = isLearned(entry) ? ['Öğrenildi', 'green'] : ['Öğrenilecek', 'gray'];

  return (
    <View style={st.screen}>
      <View style={st.header}>
        <IconButton icon="arrow-left" label="Geri" onPress={nav.back} filled />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={favorite ? 'Favorilerden çıkar' : 'Favorilere ekle'}
          onPress={() => toggleFavorite(word.id)}
          hitSlop={8}
          style={st.fav}
        >
          <MaterialCommunityIcons
            name={favorite ? 'star' : 'star-outline'}
            size={24}
            color={favorite ? colors.green : colors.muted}
          />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingTop: 24, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <View style={st.tags}>
          <Pill tone="gray" text={word.l} />
          {word.p ? <Pill tone="gray" text={word.p} /> : null}
          {status ? <Pill tone={status[1]} text={status[0]} /> : null}
        </View>

        <View style={st.wordRow}>
          <Text style={st.word} adjustsFontSizeToFit numberOfLines={2}>
            {word.en}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Telaffuzu dinle"
            onPress={() => speak(word.en)}
            style={({ pressed }) => [st.speak, pressed && { backgroundColor: colors.greenSoft }]}
          >
            <Feather name="volume-2" size={20} color={colors.green} />
          </Pressable>
        </View>
        <Text style={st.meaning}>{word.tr}</Text>

        {word.e ? (
          <>
            <View style={st.divider} />
            <Text style={st.label}>Örnek</Text>
            <Pressable onPress={() => speak(word.e)} accessibilityRole="button" accessibilityLabel="Örneği dinle">
              <Text style={st.example}>{word.e}</Text>
            </Pressable>
            <Text style={ui.body}>{word.et}</Text>
          </>
        ) : null}

        {entry ? (
          <Text style={[ui.rowSub, { marginTop: 32 }]}>
            Maçlarda {entry.c} kez doğru, {entry.w} kez yanlış bildin.
          </Text>
        ) : null}
      </ScrollView>

      <PrimaryButton icon="play" title="Pratik Yap" onPress={() => nav.startPractice(word.id)} />
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: space.gutter, paddingBottom: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  fav: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadowSoft,
  },
  tags: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  wordRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 },
  word: { flexShrink: 1, fontFamily: fonts.bold, fontSize: 42, color: colors.text, letterSpacing: -0.8 },
  speak: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meaning: { fontFamily: fonts.medium, fontSize: 20, lineHeight: 28, color: colors.text, marginTop: 8 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 32 },
  label: { fontFamily: fonts.semibold, fontSize: 13, color: colors.muted, marginBottom: 10 },
  example: { fontFamily: fonts.medium, fontSize: 18, lineHeight: 27, color: colors.text, marginBottom: 8 },
});
