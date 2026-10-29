import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ListGroup, PrimaryButton, ScreenHeader, s as ui } from '../components/ui';
import WordRow from '../components/WordRow';
import { getWord } from '../data/dictionary';
import { useNav } from '../nav';
import { useStore } from '../store';
import { space } from '../theme';

export default function SummaryScreen({ params }) {
  const nav = useNav();
  const { state, toggleFavorite } = useStore();
  const { result } = params;
  const wrong = result.answers.filter((a) => !a.correct);
  const right = result.answers.filter((a) => a.correct);

  const section = (title, list, status) =>
    list.length ? (
      <View style={{ gap: 10 }}>
        <Text style={st.section}>
          {title} · {list.length}
        </Text>
        <ListGroup>
          {list.map((a, i) => {
            const w = getWord(a.wordId);
            return (
              <WordRow
                key={a.wordId}
                word={w}
                status={status}
                favorite={state.favorites.includes(w.id)}
                onToggleFavorite={() => toggleFavorite(w.id)}
                onPress={() => nav.go('wordDetail', { id: w.id })}
                last={i === list.length - 1}
              />
            );
          })}
        </ListGroup>
      </View>
    ) : null;

  return (
    <View style={st.screen}>
      <ScreenHeader title="Maç Özeti" onBack={nav.back} />
      <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[ui.body, { marginBottom: 4 }]}>
          Yanlış bildiğin kelimeler Öğrenilecekler listene eklendi ve sonraki maçlarda tekrar karşına çıkacak.
        </Text>
        {section('Tekrar et', wrong, 'wrong')}
        {section('Bildiklerin', right, 'correct')}
      </ScrollView>
      <PrimaryButton title="Tamam" onPress={nav.back} />
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: space.gutter, paddingBottom: 24 },
  scroll: { gap: 24, paddingTop: 16, paddingBottom: 24 },
  section: { ...ui.rowSub, fontSize: 13 },
});
