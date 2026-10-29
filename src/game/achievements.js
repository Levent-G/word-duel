import { wordStats } from '../store';

export function achievements(state) {
  const { profile, streak, favorites, words } = state;
  const { learned } = wordStats(words);
  const list = [
    { id: 'first-win', title: 'İlk Zafer', desc: 'İlk düellonu kazan', icon: 'flag', value: profile.wins, goal: 1 },
    { id: 'wins-25', title: 'Düello Ustası', desc: '25 düello kazan', icon: 'award', value: profile.wins, goal: 25 },
    { id: 'perfect', title: 'Kusursuz', desc: 'Bir maçta 10 soruyu da bil', icon: 'star', value: profile.perfect, goal: 1 },
    { id: 'fast', title: 'Hızlı Parmaklar', desc: '2 saniyeden kısa sürede 30 doğru cevap', icon: 'zap', value: profile.fast, goal: 30 },
    { id: 'learn-50', title: 'Kelime Avcısı', desc: '50 kelime öğren', icon: 'book-open', value: learned, goal: 50 },
    { id: 'learn-500', title: 'Kelime Ustası', desc: '500 kelime öğren', icon: 'book', value: learned, goal: 500 },
    { id: 'streak-7', title: 'Bir Hafta', desc: '7 gün üst üste oyna', icon: 'calendar', value: streak.best, goal: 7 },
    { id: 'fav-20', title: 'Koleksiyoncu', desc: '20 kelimeyi favorine ekle', icon: 'heart', value: favorites.length, goal: 20 },
  ];
  return list.map((a) => ({ ...a, value: Math.min(a.value, a.goal), done: a.value >= a.goal }));
}
