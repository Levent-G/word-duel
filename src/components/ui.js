import { Feather } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts, radius, shadow, shadowSoft, tones } from '../theme';
import { nameError } from '../moderation';
import { LogoMark } from './Logo';

/** Pressable that shrinks slightly while held. */
export function Bouncy({ children, style, containerStyle, onPress, disabled, ...rest }) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v) => Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  return (
    <Pressable
      style={containerStyle}
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => to(0.97)}
      onPressOut={() => to(1)}
      {...rest}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

export function PrimaryButton({ title, icon, onPress, large, variant = 'green' }) {
  const white = variant === 'white';
  return (
    <Bouncy
      accessibilityRole="button"
      onPress={onPress}
      style={[s.primary, large && s.primaryLarge, white ? s.primaryWhite : s.primaryGreen]}
    >
      {icon ? <Feather name={icon} size={large ? 22 : 20} color={white ? colors.greenText : '#FFFFFF'} /> : null}
      <Text style={[s.primaryText, large && { fontSize: 18 }, white && { color: colors.greenText }]}>{title}</Text>
    </Bouncy>
  );
}

export function SecondaryButton({ title, icon, onPress, style }) {
  return (
    <Bouncy accessibilityRole="button" onPress={onPress} style={s.secondary} containerStyle={style}>
      {icon ? <Feather name={icon} size={18} color={colors.muted} /> : null}
      <Text style={s.secondaryText}>{title}</Text>
    </Bouncy>
  );
}

const answerLook = {
  idle: { bg: colors.surface, border: colors.border, text: colors.text, badge: colors.track, badgeText: colors.muted },
  correct: { bg: colors.greenSoft, border: colors.green, text: colors.greenText, badge: colors.green, badgeText: '#FFFFFF' },
  wrong: { bg: colors.redSoft, border: colors.red, text: colors.redText, badge: colors.red, badgeText: '#FFFFFF' },
  dim: { bg: colors.surface, border: colors.border, text: colors.faint, badge: colors.track, badgeText: colors.faint },
};

/** `mark` puts the opponent's avatar on the option they picked. */
export function AnswerButton({ letter, title, state = 'idle', onPress, disabled, mark }) {
  const look = answerLook[state];
  return (
    <Bouncy
      accessibilityRole="button"
      accessibilityLabel={`${letter}: ${title}`}
      disabled={disabled}
      onPress={onPress}
      style={[s.answer, { backgroundColor: look.bg, borderColor: look.border }, state === 'idle' && shadowSoft]}
    >
      <View style={[s.letter, { backgroundColor: look.badge }]}>
        {state === 'correct' || state === 'wrong' ? (
          <Feather name={state === 'correct' ? 'check' : 'x'} size={16} color="#FFFFFF" />
        ) : (
          <Text style={[s.letterText, { color: look.badgeText }]}>{letter}</Text>
        )}
      </View>
      <Text style={[s.answerText, { color: look.text }]} numberOfLines={2}>
        {title}
      </Text>
      {mark ? (
        <View style={s.mark} accessibilityLabel={`${mark} bunu seçti`}>
          <Avatar name={mark} size={26} />
        </View>
      ) : null}
    </Bouncy>
  );
}

const AVATAR_TONES = ['blue', 'orange', 'purple', 'green'];

function toneFor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return tones[AVATAR_TONES[h % AVATAR_TONES.length]];
}

export function initials(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toLocaleUpperCase('tr-TR');
}

/** `ring`: border color around the avatar (answer state in a duel, or highlight). */
export function Avatar({ name, size = 56, highlight, ring }) {
  const [bg, fg] = highlight ? tones.green : toneFor(name);
  const ringColor = ring ?? (highlight ? colors.green : null);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: ringColor ? Math.max(2, size / 24) : 0,
        borderColor: ringColor ?? 'transparent',
      }}
    >
      <Text style={{ fontFamily: fonts.bold, fontSize: size * 0.36, color: fg }}>{initials(name)}</Text>
    </View>
  );
}

export function XPBar({ value, max, label, compact, light }) {
  const pct = Math.max(0, Math.min(1, max ? value / max : 0));
  return (
    <View style={{ gap: 8 }}>
      {label ? (
        <View style={s.rowBetween}>
          <Text style={[s.xpLabel, light && { color: '#FFFFFF' }]}>{label}</Text>
          <Text style={[s.xpValue, light && { color: 'rgba(255,255,255,0.85)' }]}>
            {value.toLocaleString('tr-TR')} / {max.toLocaleString('tr-TR')} XP
          </Text>
        </View>
      ) : null}
      <View style={[s.track, compact && { height: 6 }, light && { backgroundColor: 'rgba(255,255,255,0.28)' }]}>
        <View
          style={[
            s.fill,
            compact && { height: 6 },
            light && { backgroundColor: '#FFFFFF' },
            { width: `${pct * 100}%` },
          ]}
        />
      </View>
    </View>
  );
}

export function Card({ children, style }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function IconTile({ icon, tone = 'green', size = 40 }) {
  const [bg, fg] = tones[tone];
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.32, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Feather name={icon} size={size * 0.48} color={fg} />
    </View>
  );
}

export function ListGroup({ children, style }) {
  return <View style={[s.group, style]}>{children}</View>;
}

export function ListRow({ title, subtitle, icon, tone = 'gray', right, onPress, last }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [s.row, !last && s.rowDivider, pressed && { backgroundColor: colors.bg }]}
    >
      {icon ? <IconTile icon={icon} tone={tone} size={36} /> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={s.rowTitle}>{title}</Text>
        {subtitle ? <Text style={s.rowSub}>{subtitle}</Text> : null}
      </View>
      {right !== undefined ? right : <Feather name="chevron-right" size={20} color={colors.faint} />}
    </Pressable>
  );
}

const tabs = [
  { key: 'home', label: 'Ana Sayfa', icon: 'home' },
  { key: 'words', label: 'Kelimelerim', icon: 'book-open' },
  { key: 'profile', label: 'Profil', icon: 'user' },
];

export function BottomNav({ active, onChange }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.nav, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <Pressable
            key={t.key}
            accessibilityRole="tab"
            accessibilityLabel={t.label}
            accessibilityState={{ selected: on }}
            onPress={() => onChange(t.key)}
            style={s.navItem}
          >
            <View style={[s.navPill, on && s.navPillOn]}>
              <Feather name={t.icon} size={20} color={on ? colors.greenText : colors.muted} />
              {on ? <Text style={s.navLabel}>{t.label}</Text> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SimpleModal({ visible, title, message, primary, secondary, onClose, icon, tone = 'green' }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.modal} onPress={() => {}}>
          {icon ? <IconTile icon={icon} tone={tone} size={48} /> : null}
          <Text style={s.modalTitle}>{title}</Text>
          {message ? <Text style={s.modalText}>{message}</Text> : null}
          <View style={{ gap: 10, marginTop: 8 }}>
            {primary ? <PrimaryButton title={primary.title} onPress={primary.onPress} /> : null}
            <SecondaryButton title={secondary?.title ?? 'Kapat'} onPress={secondary?.onPress ?? onClose} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function IconButton({ icon, onPress, label, color = colors.text, filled }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [s.iconBtn, filled && s.iconBtnFilled, pressed && { backgroundColor: colors.track }]}
    >
      <Feather name={icon} size={filled ? 20 : 22} color={color} />
    </Pressable>
  );
}

export function FadeIn({ children, style }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }, [v]);
  return (
    <Animated.View
      style={[
        { flex: 1, opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** A number that floats a "+N" above itself whenever it grows. */
export function ScoreValue({ value, style, align = 'left' }) {
  const prev = useRef(value);
  const anim = useRef(new Animated.Value(0)).current;
  const [delta, setDelta] = useState(0);
  useEffect(() => {
    const d = value - prev.current;
    prev.current = value;
    if (d > 0) {
      setDelta(d);
      anim.setValue(0);
      Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }).start();
    }
  }, [value, anim]);
  return (
    <View>
      <Text style={style}>{value}</Text>
      {delta ? (
        <Animated.Text
          style={[
            s.delta,
            align === 'right' ? { right: 0 } : { left: 0 },
            {
              opacity: anim.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] }),
              transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -18] }) }],
            },
          ]}
        >
          +{delta}
        </Animated.Text>
      ) : null}
    </View>
  );
}

export function ScreenHeader({ title, onBack, right }) {
  return (
    <View style={s.header}>
      {onBack ? <IconButton icon="arrow-left" label="Geri" onPress={onBack} filled /> : <View style={{ width: 44 }} />}
      <Text style={s.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={{ minWidth: 44, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}

export function Segmented({ items, value, onChange }) {
  return (
    <View style={s.segment}>
      {items.map((it) => {
        const on = it.key === value;
        return (
          <Pressable
            key={it.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(it.key)}
            style={[s.segItem, on && s.segOn]}
          >
            <Text style={[s.segText, on && { color: colors.text, fontFamily: fonts.bold }]}>{it.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Pill({ text, tone = 'green', icon, style }) {
  const [bg, fg] = tones[tone];
  return (
    <View style={[s.pill, { backgroundColor: bg }, style]}>
      {icon ? <Feather name={icon} size={13} color={fg} /> : null}
      <Text style={[s.pillText, { color: fg }]}>{text}</Text>
    </View>
  );
}

export function SwitchRow({ title, icon, tone = 'gray', value, onChange, last }) {
  return (
    <View style={[s.row, !last && s.rowDivider]}>
      {icon ? <IconTile icon={icon} tone={tone} size={36} /> : null}
      <Text style={[s.rowTitle, { flex: 1 }]}>{title}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.track, true: colors.green }}
        thumbColor="#FFFFFF"
        ios_backgroundColor={colors.track}
      />
    </View>
  );
}

export function NameModal({ visible, title, initial = '', onSubmit, onClose, logo }) {
  const [name, setName] = useState(initial);
  useEffect(() => {
    if (visible) setName(initial);
  }, [visible, initial]);
  const error = nameError(name);
  const ok = !error;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose ?? (() => {})}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.backdrop}>
        <View style={s.modal}>
          {logo ? <LogoMark size={64} /> : <IconTile icon="smile" tone="green" size={48} />}
          <Text style={s.modalTitle}>{title}</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Adın"
            placeholderTextColor={colors.muted}
            accessibilityLabel="Adın"
            autoFocus
            maxLength={20}
            style={s.field}
            onSubmitEditing={() => ok && onSubmit(name.trim())}
          />
          {name.trim().length >= 2 && error ? <Text style={s.fieldError}>{error}</Text> : null}
          <Text style={s.fieldHint}>Adın rakiplerine ve sıralamada görünür.</Text>
          <View style={{ gap: 10, marginTop: 8, opacity: ok ? 1 : 0.5 }}>
            <PrimaryButton title="Kaydet" onPress={() => ok && onSubmit(name.trim())} />
          </View>
          {onClose ? <SecondaryButton title="Vazgeç" onPress={onClose} /> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function EmptyText({ children }) {
  return <Text style={[s.body, { textAlign: 'center', marginTop: 40, paddingHorizontal: 16 }]}>{children}</Text>;
}

export const s = StyleSheet.create({
  primary: {
    height: 56,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryGreen: {
    backgroundColor: colors.green,
    shadowColor: colors.green,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  primaryWhite: { backgroundColor: '#FFFFFF' },
  primaryLarge: { height: 60 },
  primaryText: { fontFamily: fonts.bold, fontSize: 17, color: '#FFFFFF' },
  secondary: {
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  secondaryText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  answer: {
    minHeight: 70,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    paddingLeft: 12,
    paddingRight: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  letter: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  letterText: { fontFamily: fonts.bold, fontSize: 15 },
  answerText: { flex: 1, fontFamily: fonts.semibold, fontSize: 18 },
  mark: { borderRadius: 15, borderWidth: 2, borderColor: '#FFFFFF' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  xpLabel: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  xpValue: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.track, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.green },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: 18, ...shadow },
  group: { backgroundColor: colors.surface, borderRadius: radius.xl, ...shadow },
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 12 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.track },
  rowTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  rowSub: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
  nav: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    paddingTop: 10,
    paddingHorizontal: 12,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#202B3C',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 10,
  },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  navPill: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, paddingHorizontal: 14, borderRadius: 20 },
  navPillOn: { backgroundColor: colors.greenSoft },
  navLabel: { fontFamily: fonts.bold, fontSize: 13, color: colors.greenText },
  backdrop: { flex: 1, backgroundColor: 'rgba(32,43,60,0.4)', justifyContent: 'center', padding: 24 },
  modal: { backgroundColor: colors.surface, borderRadius: 24, padding: 24, gap: 10 },
  modalTitle: { fontFamily: fonts.bold, fontSize: 20, color: colors.text, marginTop: 4 },
  modalText: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.muted },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  iconBtnFilled: { backgroundColor: colors.surface, ...shadowSoft },
  delta: { position: 'absolute', top: -14, fontFamily: fonts.extrabold, fontSize: 13, color: colors.green },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  headerTitle: { flex: 1, textAlign: 'center', fontFamily: fonts.bold, fontSize: 17, color: colors.text },
  segment: { flexDirection: 'row', backgroundColor: colors.track, borderRadius: radius.md, padding: 4 },
  segItem: { flex: 1, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
  segOn: { backgroundColor: colors.surface, ...shadowSoft },
  segText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.muted },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  pillText: { fontFamily: fonts.bold, fontSize: 12 },
  field: {
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.text,
    marginTop: 4,
  },
  fieldError: { fontFamily: fonts.semibold, fontSize: 13, color: colors.redText },
  fieldHint: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  h1: { fontFamily: fonts.bold, fontSize: 28, color: colors.text, letterSpacing: -0.5 },
  body: { fontFamily: fonts.regular, fontSize: 16, color: colors.muted },
});
