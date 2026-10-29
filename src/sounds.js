import { createAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Platform, Vibration } from 'react-native';

import { ensureAudioMode } from './speech';

const { ImpactFeedbackStyle: Impact, NotificationFeedbackType: Notify } = Haptics;

const impact = (style) => () => Haptics.impactAsync(style);
const notify = (type) => () => Haptics.notificationAsync(type);

/** The vibration that accompanies each effect. */
const HAPTICS = {
  search: impact(Impact.Soft),
  found: notify(Notify.Success),
  tick: impact(Impact.Light),
  go: impact(Impact.Heavy),
  next: () => Haptics.selectionAsync(),
  correct: notify(Notify.Success),
  wrong: notify(Notify.Error),
  opponent: impact(Impact.Light),
  hurry: impact(Impact.Rigid),
  win: () => {
    Haptics.notificationAsync(Notify.Success);
    setTimeout(() => Haptics.impactAsync(Impact.Heavy).catch(() => {}), 320);
    return Promise.resolve();
  },
  lose: notify(Notify.Warning),
  draw: impact(Impact.Medium),
  reward: notify(Notify.Success),
};

/**
 * Android patterns in ms: [wait, buzz, pause, buzz, …]. expo-haptics drives the Android motor at
 * 12–27% amplitude for ~50 ms, which many phones never make perceptible, so Android uses
 * full-strength Vibration patterns instead; iOS keeps the Taptic Engine feedback above.
 */
const ANDROID = {
  search: [0, 18],
  found: [0, 40, 70, 70],
  tick: [0, 30],
  go: [0, 90],
  next: [0, 15],
  correct: [0, 35, 60, 35],
  wrong: [0, 90, 60, 110],
  opponent: [0, 25],
  hurry: [0, 30],
  win: [0, 60, 70, 60, 70, 160],
  lose: [0, 220],
  draw: [0, 60, 90, 60],
  reward: [0, 40, 50, 40],
};

let hapticsOn = true;

export function setHapticsEnabled(on) {
  hapticsOn = on;
  if (!on) Vibration.cancel();
}

function vibrate(name) {
  if (!hapticsOn) return;
  try {
    if (Platform.OS === 'android') {
      if (ANDROID[name]) Vibration.vibrate(ANDROID[name]);
    } else if (HAPTICS[name]) {
      HAPTICS[name]().catch(() => {});
    }
  } catch {
    // Devices without a vibration motor.
  }
}

const SOURCES = {
  search: require('../assets/sounds/search.wav'),
  found: require('../assets/sounds/found.wav'),
  tick: require('../assets/sounds/tick.wav'),
  go: require('../assets/sounds/go.wav'),
  correct: require('../assets/sounds/correct.wav'),
  wrong: require('../assets/sounds/wrong.wav'),
  next: require('../assets/sounds/next.wav'),
  opponent: require('../assets/sounds/opponent.wav'),
  hurry: require('../assets/sounds/hurry.wav'),
  win: require('../assets/sounds/win.wav'),
  lose: require('../assets/sounds/lose.wav'),
  draw: require('../assets/sounds/draw.wav'),
  reward: require('../assets/sounds/reward.wav'),
};

const players = {};
let enabled = true;

function player(name) {
  if (!players[name]) players[name] = createAudioPlayer(SOURCES[name]);
  return players[name];
}

export function setSoundEnabled(on) {
  enabled = on;
  if (!on) stopLoop();
}

/** Plays a one-shot effect from the start, cutting off any earlier play of the same effect. */
export async function playSound(name) {
  vibrate(name);
  if (!enabled) return;
  try {
    await ensureAudioMode();
    const p = player(name);
    p.loop = false;
    await p.seekTo(0);
    p.play();
  } catch {
    // Missing audio output or a released player should never break the game.
  }
}

let looping = null;
let loopBuzz = null;

const LOOP_MS = { search: 1600 };

export async function startLoop(name) {
  stopLoop();
  vibrate(name);
  loopBuzz = setInterval(() => vibrate(name), LOOP_MS[name] ?? 1600);
  if (!enabled) return;
  try {
    await ensureAudioMode();
    const p = player(name);
    p.loop = true;
    await p.seekTo(0);
    p.play();
    looping = name;
  } catch {
    looping = null;
  }
}

export function stopLoop() {
  if (loopBuzz) {
    clearInterval(loopBuzz);
    loopBuzz = null;
  }
  if (!looping) return;
  try {
    players[looping].pause();
    players[looping].loop = false;
  } catch {
    // ignore
  }
  looping = null;
}

/** Preloads the effects used in a match so the first answer does not lag. */
export function preloadSounds() {
  Object.keys(SOURCES).forEach(player);
}
