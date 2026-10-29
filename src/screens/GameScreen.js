import { Feather } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';

import { AnswerButton, Avatar, Card, IconButton, Pill, ScoreValue, SimpleModal } from '../components/ui';
import { botAccuracy } from '../game/bots';
import { pointsFor } from '../game/scoring';
import { useNav } from '../nav';
import { REACTIONS, leaveMatch, listenMatch, sendAnswer, sendReaction } from '../online/api';
import { playSound } from '../sounds';
import { speak, stopSpeaking } from '../speech';
import { useStore } from '../store';
import { colors, fonts, space } from '../theme';

const QUESTION_SECONDS = 10;
const REVEAL_MS = 1400;
const FAST_SECONDS = 2;
const ONLINE_GRACE_MS = 4000;
const BUBBLE_MS = 2500;
const REACTION_COOLDOWN_MS = 3000;
const BOT_REACTION_CHANCE = 0.18;
const LETTERS = ['A', 'B', 'C', 'D'];

const TYPE_PILL = {
  meaning: { text: 'Anlamı ne?', icon: 'help-circle', tone: 'blue' },
  reverse: { text: 'İngilizcesi?', icon: 'repeat', tone: 'purple' },
  blank: { text: 'Boşluğu doldur', icon: 'edit-3', tone: 'orange' },
};

const points = (secondsLeft) => pointsFor(QUESTION_SECONDS - secondsLeft);

/** Bot behaviour for one question: when it answers, whether it is right, which option it taps. */
function planBot(question, rating) {
  const correct = Math.random() < botAccuracy(rating);
  const wrongIds = question.options.filter((o) => o.id !== question.word.id).map((o) => o.id);
  const at = Math.random() < 0.07 ? Infinity : 1.4 + Math.random() * (correct ? 5.5 : 7);
  return { at, correct, pickId: correct ? question.word.id : wrongIds[Math.floor(Math.random() * wrongIds.length)] };
}

function ReactionBubble({ reaction, side }) {
  const rx = REACTIONS.find((x) => x.key === reaction);
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.spring(v, { toValue: 1, friction: 5, useNativeDriver: true }),
      Animated.delay(BUBBLE_MS - 600),
      Animated.timing(v, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start();
  }, [v]);
  if (!rx) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        st.bubble,
        side === 'left' ? { left: 10 } : { right: 10 },
        { opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] },
      ]}
    >
      <Text style={st.bubbleEmoji}>{rx.emoji}</Text>
      <Text style={st.bubbleText}>{rx.text}</Text>
    </Animated.View>
  );
}

function Dots({ results, total, current, align }) {
  return (
    <View style={[st.dots, align === 'right' && { justifyContent: 'flex-end' }]}>
      {Array.from({ length: total }, (_, i) => {
        const r = results[i];
        let bg = colors.track;
        if (r === true) bg = colors.green;
        else if (r === false) bg = colors.red;
        return <View key={i} style={[st.dot, { backgroundColor: bg }, i === current && r === undefined && st.dotNow]} />;
      })}
    </View>
  );
}

export default function GameScreen({ params }) {
  const nav = useNav();
  const { state } = useStore();
  const { questions, opponent, mode, online, kind } = params.match;
  const duel = mode === 'duel';
  const isBot = duel && !online;
  const { autoSpeak } = state.settings;
  const myName = state.profile.name || 'Sen';
  const opName = opponent?.name.split(' ')[0];

  const [index, setIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(QUESTION_SECONDS);
  const [myPick, setMyPick] = useState(null);
  const [botPick, setBotPick] = useState(null);
  const [myScore, setMyScore] = useState(0);
  const [opScore, setOpScore] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [opAnswers, setOpAnswers] = useState([]);
  const [quitOpen, setQuitOpen] = useState(false);
  const [remote, setRemote] = useState({ answers: {}, present: false });
  const [oppLeft, setOppLeft] = useState(false);

  const q = questions[index];
  const bot = useRef(isBot ? planBot(questions[0], opponent.rating) : null);
  const seenOpponent = useRef(false);
  const navRef = useRef(nav);
  navRef.current = nav;

  const iAnswered = myPick !== null;
  const botAnswered = !duel || botPick !== null;
  const done = iAnswered && botAnswered;

  useEffect(() => {
    if (index > 0) playSound('next');
    if (autoSpeak && q.type === 'meaning') {
      const word = q.word.en;
      const t = setTimeout(() => speak(word), index > 0 ? 250 : 0);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => stopSpeaking, []);

  useEffect(() => {
    if (done || quitOpen) return undefined;
    const t = setInterval(() => setTimeLeft((s) => Math.max(0, s - 0.1)), 100);
    return () => clearInterval(t);
  }, [done, quitOpen]);

  const answerMine = (choice) => {
    if (iAnswered) return;
    const correct = choice === q.word.id;
    const time = choice === 'timeout' ? null : QUESTION_SECONDS - timeLeft;
    setMyPick(choice);
    if (correct) setMyScore((v) => v + points(timeLeft));
    setAnswers((a) => [
      ...a,
      { wordId: q.word.id, correct, time, fast: correct && time < FAST_SECONDS, type: q.type },
    ]);
    playSound(correct ? 'correct' : 'wrong');
    if (online) sendAnswer(online.matchId, online.uid, index, choice, time);
    if (autoSpeak && q.type !== 'meaning') {
      const word = q.word.en;
      setTimeout(() => speak(word), 450);
    }
  };

  /** Records the opponent's answer for the current question; `time` is null when they ran out of time. */
  const applyOpponent = (pick, time) => {
    if (botPick !== null) return;
    const timedOut = pick === 'timeout' || time === null;
    const correct = !timedOut && pick === q.word.id;
    setBotPick(timedOut ? 'timeout' : pick);
    if (correct) setOpScore((v) => v + points(Math.max(0, QUESTION_SECONDS - time)));
    setOpAnswers((r) => [...r, { correct, time: timedOut ? null : time, fast: correct && time < FAST_SECONDS }]);
    if (!iAnswered && !timedOut) playSound('opponent');
  };

  const answerBot = (timedOut) => {
    const plan = bot.current;
    applyOpponent(timedOut ? 'timeout' : plan.pickId, timedOut ? null : plan.at);
  };

  // Online: mirror the opponent's answers, presence and reactions from the match node.
  useEffect(() => {
    if (!online) return undefined;
    return listenMatch(online.matchId, (val) => {
      setRemote({
        answers: val?.answers?.[online.oppUid] ?? {},
        present: !!val?.presence?.[online.oppUid],
        reaction: val?.reactions?.[online.oppUid] ?? null,
      });
    });
  }, [online]);

  // ----- quick reactions -----
  const [trayOpen, setTrayOpen] = useState(false);
  const [myBubble, setMyBubble] = useState(null);
  const [oppBubble, setOppBubble] = useState(null);
  const lastSent = useRef(0);
  const lastSeenReaction = useRef(null);

  const showBubble = (setter, key) => {
    const id = Date.now() + Math.random();
    setter({ key, id });
    setTimeout(() => setter((b) => (b?.id === id ? null : b)), BUBBLE_MS);
  };

  const react = (key) => {
    setTrayOpen(false);
    if (Date.now() - lastSent.current < REACTION_COOLDOWN_MS) return;
    lastSent.current = Date.now();
    showBubble(setMyBubble, key);
    if (online) sendReaction(online.matchId, online.uid, key);
  };

  useEffect(() => {
    const rx = remote.reaction;
    if (!rx?.at || lastSeenReaction.current === rx.at) return;
    lastSeenReaction.current = rx.at;
    showBubble(setOppBubble, rx.k);
    playSound('opponent');
  }, [remote.reaction?.at]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bots chime in now and then, so the feature is visible offline too.
  useEffect(() => {
    if (!isBot || !iAnswered || !botAnswered || Math.random() > BOT_REACTION_CHANCE) return undefined;
    const mine = answers[index];
    let key = 'gg';
    if (mine?.correct && mine.time < FAST_SECONDS + 1) key = 'fast';
    else if (Math.abs(myScore - opScore) < 60) key = 'close';
    else if (opAnswers[index]?.correct && !mine?.correct) key = 'wow';
    const t = setTimeout(() => showBubble(setOppBubble, key), 500);
    return () => clearTimeout(t);
  }, [isBot && iAnswered && botAnswered, index]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!online) return;
    if (remote.present) seenOpponent.current = true;
    else if (seenOpponent.current) setOppLeft(true);
  }, [online, remote.present]);

  useEffect(() => {
    if (!online || botPick !== null) return;
    const a = remote.answers[index];
    if (a) applyOpponent(a.p, a.t < 0 ? null : a.t);
    else if (oppLeft) applyOpponent('timeout', null);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  // Online grace period: a lost answer must not freeze the match.
  useEffect(() => {
    if (!online || timeLeft > 0 || botPick !== null) return undefined;
    const t = setTimeout(() => applyOpponent('timeout', null), ONLINE_GRACE_MS);
    return () => clearTimeout(t);
  }, [online, timeLeft <= 0, botPick, index]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => online && leaveMatch(), [online]);

  const secsLeft = Math.ceil(timeLeft);
  useEffect(() => {
    if (!iAnswered && !quitOpen && secsLeft <= 3 && secsLeft > 0) playSound('hurry');
  }, [secsLeft]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (done) return;
    const elapsed = QUESTION_SECONDS - timeLeft;
    if (isBot && botPick === null && elapsed >= bot.current.at) answerBot(false);
    if (timeLeft <= 0) {
      if (!iAnswered) answerMine('timeout');
      if (isBot && botPick === null) answerBot(true);
    }
  });

  useEffect(() => {
    if (!done) return undefined;
    const t = setTimeout(() => {
      if (index + 1 < questions.length) {
        if (isBot) bot.current = planBot(questions[index + 1], opponent.rating);
        setMyPick(null);
        setBotPick(null);
        setTimeLeft(QUESTION_SECONDS);
        setIndex((i) => i + 1);
      } else {
        if (online) leaveMatch();
        navRef.current.finishMatch({
          mode,
          kind,
          online,
          oppLeft,
          opponent,
          myScore,
          opScore,
          answers,
          opAnswers,
          correct: answers.filter((a) => a.correct).length,
          fastAnswers: answers.filter((a) => a.fast).length,
          total: questions.length,
        });
      }
    }, REVEAL_MS);
    return () => clearTimeout(t);
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setQuitOpen(true);
      return true;
    });
    return () => sub.remove();
  }, []);

  const stateFor = (opt) => {
    if (!iAnswered) return 'idle';
    if (opt.id === q.word.id) return 'correct';
    if (opt.id === myPick) return 'wrong';
    return 'dim';
  };

  const showBotMark = duel && iAnswered && botPick && botPick !== 'timeout';
  const opLast = opAnswers[index]?.correct;
  const opRing = botPick === null ? colors.border : opLast ? colors.green : colors.red;
  const myLast = answers[index]?.correct;
  const myRing = !iAnswered ? colors.green : myLast ? colors.green : colors.red;

  const secs = Math.ceil(timeLeft);
  const low = secs <= 3 && !done;
  const pill = TYPE_PILL[q.type];
  const textStyle = q.type === 'blank' ? st.sentence : q.type === 'reverse' ? st.reverse : st.word;

  let feedback = null;
  if (iAnswered && myPick !== q.word.id) {
    feedback = (
      <Text style={st.toLearn}>{q.type === 'meaning' ? '' : `${q.word.en} · `}Öğrenileceklere eklendi</Text>
    );
  } else if (iAnswered && !botAnswered) {
    feedback = <Text style={st.waiting}>{opName} {timeLeft <= 0 ? 'bağlantısı bekleniyor…' : 'düşünüyor…'}</Text>;
  } else if (iAnswered) {
    feedback = <Text style={st.correctText}>Doğru!</Text>;
  }

  return (
    <View style={st.screen}>
      <View style={st.header}>
        <IconButton icon="x" label={duel ? 'Maçtan çık' : 'Pratikten çık'} onPress={() => setQuitOpen(true)} filled />
        <Text style={st.counter}>
          Soru {index + 1}
          <Text style={{ color: colors.faint }}> / {questions.length}</Text>
        </Text>
        <View style={[st.timer, low && { backgroundColor: colors.redSoft }]}>
          <Feather name="clock" size={15} color={low ? colors.red : colors.greenText} />
          <Text style={[st.timerText, low && { color: colors.redText }]}>{secs}</Text>
        </View>
      </View>

      <Card style={[st.board, (trayOpen || myBubble || oppBubble) && st.boardFront]}>
        <View style={st.boardRow}>
          <View style={st.side}>
            <Avatar name={myName} size={44} highlight ring={myRing} />
            <View>
              <Text style={st.sideName}>Sen</Text>
              <ScoreValue value={myScore} style={st.score} />
            </View>
          </View>
          {duel ? (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Tepki gönder"
                onPress={() => setTrayOpen((o) => !o)}
                hitSlop={8}
                style={[st.vs, trayOpen && { backgroundColor: colors.green }]}
              >
                <Feather name={trayOpen ? 'x' : 'smile'} size={17} color="#FFFFFF" />
              </Pressable>
              <View style={[st.side, { justifyContent: 'flex-end' }]}>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[st.sideName, oppLeft && { color: colors.redText }]}>
                    {oppLeft ? 'Ayrıldı' : botPick === null ? 'Düşünüyor…' : 'Cevapladı'}
                  </Text>
                  <ScoreValue value={opScore} style={st.score} align="right" />
                </View>
                <Avatar name={opponent.name} size={44} ring={opRing} />
              </View>
            </>
          ) : (
            <Pill text="Pratik" tone="purple" icon="book-open" />
          )}
        </View>
        <View style={st.dotsRow}>
          <Dots results={answers.map((a) => a.correct)} total={questions.length} current={index} />
          {duel ? (
            <Dots results={opAnswers.map((a) => a.correct)} total={questions.length} current={index} align="right" />
          ) : null}
        </View>
        {myBubble ? <ReactionBubble key={myBubble.id} reaction={myBubble.key} side="left" /> : null}
        {oppBubble ? <ReactionBubble key={oppBubble.id} reaction={oppBubble.key} side="right" /> : null}
        {trayOpen ? (
          <View style={st.tray}>
            {REACTIONS.map((rx) => (
              <Pressable
                key={rx.key}
                accessibilityRole="button"
                accessibilityLabel={rx.text}
                onPress={() => react(rx.key)}
                style={({ pressed }) => [st.trayItem, pressed && { backgroundColor: colors.greenSoft }]}
              >
                <Text style={st.trayEmoji}>{rx.emoji}</Text>
                <Text style={st.trayText}>{rx.text}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </Card>

      <Card style={st.question}>
        <View style={st.timeTrack}>
          <View
            style={[
              st.timeFill,
              { width: `${(timeLeft / QUESTION_SECONDS) * 100}%`, backgroundColor: low ? colors.red : colors.green },
            ]}
          />
        </View>
        <View style={st.qTop}>
          <Pill text={pill.text} icon={pill.icon} tone={pill.tone} />
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {q.reason === 'shared' ? <Pill text="Ortak tekrar" tone="red" icon="users" /> : null}
            {q.reason === 'review' ? <Pill text="Tekrar" tone="orange" icon="rotate-ccw" /> : null}
            <Pill text={q.word.l} tone="gray" />
          </View>
        </View>
        <View style={st.qBody}>
          <Text style={textStyle} adjustsFontSizeToFit numberOfLines={q.type === 'blank' ? 5 : 2}>
            {q.text}
          </Text>
          {q.type === 'meaning' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Kelimeyi dinle"
              onPress={() => speak(q.word.en)}
              hitSlop={8}
              style={({ pressed }) => [st.speak, pressed && { backgroundColor: colors.green }]}
            >
              {({ pressed }) => <Feather name="volume-2" size={18} color={pressed ? '#FFFFFF' : colors.green} />}
            </Pressable>
          ) : null}
        </View>
        <View style={st.feedback}>{feedback}</View>
      </Card>

      <View style={st.answers}>
        {q.options.map((opt, i) => (
          <AnswerButton
            key={opt.id}
            letter={LETTERS[i]}
            title={opt.label}
            state={stateFor(opt)}
            disabled={iAnswered}
            onPress={() => answerMine(opt.id)}
            mark={showBotMark && botPick === opt.id ? opponent.name : null}
          />
        ))}
      </View>

      <SimpleModal
        visible={quitOpen}
        icon="log-out"
        tone="red"
        title={duel ? 'Maçtan çıkılsın mı?' : 'Pratikten çıkılsın mı?'}
        message={duel ? 'Bu maçtaki ilerlemen kaydedilmeyecek.' : 'Bu pratikteki ilerlemen kaydedilmeyecek.'}
        primary={{ title: 'Devam Et', onPress: () => setQuitOpen(false) }}
        secondary={{ title: duel ? 'Maçtan Çık' : 'Pratikten Çık', onPress: () => nav.reset('home') }}
        onClose={() => setQuitOpen(false)}
      />
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: space.gutter, paddingBottom: 16, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  counter: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  timer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    minWidth: 64,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: colors.greenSoft,
  },
  timerText: { fontFamily: fonts.extrabold, fontSize: 16, color: colors.greenText, fontVariant: ['tabular-nums'] },
  board: { paddingVertical: 14, paddingHorizontal: 14, gap: 12 },
  boardRow: { flexDirection: 'row', alignItems: 'center' },
  side: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  sideName: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  score: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.text, fontVariant: ['tabular-nums'] },
  vs: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vsText: { fontFamily: fonts.extrabold, fontSize: 11, color: '#FFFFFF' },
  dotsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  boardFront: { zIndex: 20, elevation: 20 },
  bubble: {
    position: 'absolute',
    top: -34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.text,
    zIndex: 5,
    elevation: 8,
  },
  bubbleEmoji: { fontSize: 16 },
  bubbleText: { fontFamily: fonts.bold, fontSize: 13, color: '#FFFFFF' },
  tray: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 8,
    flexDirection: 'row',
    gap: 6,
    padding: 6,
    borderRadius: 18,
    backgroundColor: colors.surface,
    zIndex: 10,
    elevation: 12,
    shadowColor: '#202B3C',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  trayItem: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 8, borderRadius: 12 },
  trayEmoji: { fontSize: 22 },
  trayText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.muted },
  dots: { flex: 1, flexDirection: 'row', gap: 4 },
  dot: { width: 10, height: 6, borderRadius: 3 },
  dotNow: { backgroundColor: colors.faint },
  question: { flex: 1, padding: 0, overflow: 'hidden', minHeight: 150 },
  timeTrack: { height: 5, backgroundColor: colors.track },
  timeFill: { height: 5 },
  qTop: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 14 },
  qBody: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 18 },
  word: { fontFamily: fonts.extrabold, fontSize: 30, color: colors.text, letterSpacing: -0.4, textAlign: 'center' },
  reverse: { fontFamily: fonts.bold, fontSize: 24, color: colors.text, textAlign: 'center' },
  sentence: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 26, color: colors.text, textAlign: 'center' },
  speak: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedback: { height: 30, alignItems: 'center', justifyContent: 'center' },
  toLearn: { fontFamily: fonts.semibold, fontSize: 13, color: colors.redText },
  waiting: { fontFamily: fonts.semibold, fontSize: 13, color: colors.muted },
  correctText: { fontFamily: fonts.bold, fontSize: 13, color: colors.greenText },
  answers: { gap: 12 },
});
