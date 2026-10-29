import { Feather } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { EmptyText, Segmented, s as ui } from '../components/ui';
import WordRow from '../components/WordRow';
import { getWord, searchWords } from '../data/dictionary';
import { useNav } from '../nav';
import { isLearned, useStore, wordStats } from '../store';
import { colors, fonts, radius, shadowSoft, space } from '../theme';

const FILTERS = [
  { key: 'all', label: 'Tümü' },
  { key: 'learn', label: 'Öğrenilecekler' },
  { key: 'fav', label: 'Favoriler' },
];

const EMPTY = {
  all: 'Düello yaptıkça karşılaştığın kelimeler burada birikir.',
  learn: 'Yanlış bildiğin kelimeler burada toplanır. Doğru bildiğinde listeden çıkar.',
  fav: 'Yıldızladığın kelimeler burada görünür.',
};

export default function WordsScreen() {
  const nav = useNav();
  const { state, toggleFavorite } = useStore();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const stats = wordStats(state.words);
  const searching = query.trim().length >= 2;

  const list = useMemo(() => {
    if (searching) return searchWords(query);
    if (filter === 'fav') return state.favorites.map(getWord).filter(Boolean);
    return Object.entries(state.words)
      .filter(([, e]) => filter === 'all' || !isLearned(e))
      .sort((a, b) => b[1].t - a[1].t)
      .map(([id]) => getWord(id))
      .filter(Boolean);
  }, [searching, query, filter, state.words, state.favorites]);

  return (
    <View style={st.screen}>
      <View style={{ marginTop: 16, gap: 4 }}>
        <Text style={ui.h1}>Kelimelerim</Text>
        <Text style={ui.rowSub}>
          {stats.seen} kelime · {stats.toLearn} öğrenilecek
        </Text>
      </View>

      <View style={st.search}>
        <Feather name="search" size={18} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Sözlükte ara (İngilizce veya Türkçe)"
          placeholderTextColor={colors.muted}
          accessibilityLabel="Sözlükte ara"
          style={st.input}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {query ? (
          <Pressable accessibilityLabel="Aramayı temizle" onPress={() => setQuery('')} hitSlop={10}>
            <Feather name="x" size={18} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>

      {searching ? null : (
        <View style={{ marginTop: 14 }}>
          <Segmented items={FILTERS} value={filter} onChange={setFilter} />
        </View>
      )}

      <FlatList
        data={list}
        keyExtractor={(w) => w.id}
        style={{ marginTop: 16, marginHorizontal: -space.gutter }}
        contentContainerStyle={{ paddingBottom: 24, paddingHorizontal: space.gutter }}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={15}
        ListEmptyComponent={<EmptyText>{searching ? 'Sonuç bulunamadı' : EMPTY[filter]}</EmptyText>}
        renderItem={({ item, index }) => (
          <View
            style={[
              st.cell,
              index === 0 && st.first,
              index === list.length - 1 && st.last,
            ]}
          >
            <WordRow
              word={item}
              favorite={state.favorites.includes(item.id)}
              onToggleFavorite={() => toggleFavorite(item.id)}
              onPress={() => nav.go('wordDetail', { id: item.id })}
              last={index === list.length - 1}
            />
          </View>
        )}
      />
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: space.gutter },
  search: {
    marginTop: 20,
    height: 50,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...shadowSoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },
  input: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.text, paddingVertical: 0 },
  cell: { backgroundColor: colors.surface, overflow: 'hidden' },
  first: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
  last: { borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl },
});
