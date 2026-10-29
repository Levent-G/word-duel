// Synthesises the game's sound effects into assets/sounds/*.wav (44.1 kHz, 16-bit mono).
// Usage: npm run sounds
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RATE = 44100;
const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../assets/sounds');
mkdirSync(dir, { recursive: true });

const N = (name) => {
  const notes = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
  const m = /^([A-G])(b|#)?(\d)$/.exec(name);
  const semis = notes[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) - 4) * 12;
  return 440 * 2 ** (semis / 12);
};

function wave(type, phase) {
  const x = phase % 1;
  switch (type) {
    case 'triangle':
      return 4 * Math.abs(x - 0.5) - 1;
    case 'square':
      return x < 0.5 ? 0.6 : -0.6;
    case 'bell':
      return Math.sin(2 * Math.PI * x) + 0.35 * Math.sin(4 * Math.PI * x) + 0.12 * Math.sin(6 * Math.PI * x);
    default:
      return Math.sin(2 * Math.PI * x);
  }
}

/** Builds one clip; `tones` are { f, at, dur, type, vol, attack, slide } in seconds. */
function clip(length, tones, gain = 0.8) {
  const buf = new Float32Array(Math.ceil(length * RATE));
  for (const t of tones) {
    const { f, at = 0, dur, type = 'sine', vol = 1, attack = 0.005, slide = 0 } = t;
    const start = Math.floor(at * RATE);
    const n = Math.floor(dur * RATE);
    let phase = 0;
    for (let i = 0; i < n && start + i < buf.length; i++) {
      const time = i / RATE;
      const freq = f * (1 + (slide * time) / dur);
      phase += freq / RATE;
      const env = Math.min(1, time / attack) * Math.exp((-4.5 * time) / dur);
      buf[start + i] += wave(type, phase) * env * vol;
    }
  }
  let peak = 0;
  for (const v of buf) peak = Math.max(peak, Math.abs(v));
  const k = peak ? gain / peak : 0;
  const fadeOut = Math.min(buf.length, Math.floor(0.01 * RATE));
  for (let i = 0; i < buf.length; i++) {
    buf[i] *= k;
    if (i > buf.length - fadeOut) buf[i] *= (buf.length - i) / fadeOut;
  }
  return buf;
}

function writeWav(name, samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => data.writeInt16LE(Math.max(-1, Math.min(1, v)) * 32767, i * 2));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  writeFileSync(resolve(dir, `${name}.wav`), Buffer.concat([header, data]));
  console.log(`${name}.wav ${(samples.length / RATE).toFixed(2)}s`);
}

const arp = (names, step, dur, type = 'bell', vol = 1) =>
  names.map((n, i) => ({ f: N(n), at: i * step, dur, type, vol }));

const SOUNDS = {
  // Soft sonar ping, loops while matchmaking.
  search: clip(1.6, [
    { f: N('A5'), dur: 0.9, type: 'sine', vol: 1 },
    { f: N('E6'), at: 0.09, dur: 0.6, type: 'sine', vol: 0.45 },
  ], 0.45),
  found: clip(0.75, arp(['G5', 'B5', 'D6', 'G6'], 0.07, 0.45), 0.7),
  tick: clip(0.12, [{ f: 1050, dur: 0.1, type: 'triangle' }], 0.55),
  go: clip(0.45, [
    { f: N('C6'), dur: 0.4, type: 'bell' },
    { f: N('G6'), dur: 0.4, type: 'bell', vol: 0.6 },
  ], 0.7),
  correct: clip(0.5, arp(['C6', 'G6'], 0.085, 0.35), 0.7),
  wrong: clip(0.45, [
    { f: 233, dur: 0.18, type: 'square', vol: 0.7 },
    { f: 175, at: 0.15, dur: 0.28, type: 'square', vol: 0.8, slide: -0.15 },
  ], 0.45),
  // Quick upward swish between questions.
  next: clip(0.22, [
    { f: 520, dur: 0.18, type: 'sine', slide: 0.9, attack: 0.02 },
    { f: 1040, at: 0.02, dur: 0.16, type: 'sine', vol: 0.25, slide: 0.9, attack: 0.02 },
  ], 0.4),
  opponent: clip(0.12, [{ f: 640, dur: 0.1, type: 'sine', slide: 0.3 }], 0.4),
  hurry: clip(0.1, [{ f: 1480, dur: 0.07, type: 'triangle' }], 0.35),
  win: clip(1.6, [
    ...arp(['C5', 'E5', 'G5'], 0.1, 0.4),
    { f: N('C6'), at: 0.3, dur: 1.2, type: 'bell' },
    { f: N('E6'), at: 0.3, dur: 1.2, type: 'bell', vol: 0.5 },
    { f: N('G5'), at: 0.3, dur: 1.2, type: 'bell', vol: 0.5 },
  ], 0.75),
  lose: clip(1.3, [
    { f: N('G4'), dur: 0.45, type: 'triangle' },
    { f: N('Eb4'), at: 0.28, dur: 0.45, type: 'triangle' },
    { f: N('C4'), at: 0.56, dur: 0.75, type: 'triangle' },
  ], 0.6),
  draw: clip(0.9, [
    { f: N('E5'), dur: 0.4, type: 'bell' },
    { f: N('E5'), at: 0.22, dur: 0.6, type: 'bell', vol: 0.8 },
  ], 0.6),
  reward: clip(0.55, [
    { f: N('B5'), dur: 0.12, type: 'square', vol: 0.6 },
    { f: N('E6'), at: 0.08, dur: 0.45, type: 'square', vol: 0.6 },
  ], 0.4),
};

for (const [name, samples] of Object.entries(SOUNDS)) writeWav(name, samples);
