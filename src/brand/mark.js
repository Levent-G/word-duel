// Word Duel mark, drawn on a 100×100 grid. Shared by the in-app <Logo> and scripts/build-brand.mjs.
// Two speech bubbles face off: the white one says "W", the navy one answers with a bolt.

export const BRAND = {
  green: '#36B985',
  navy: '#202B3C',
  white: '#FFFFFF',
  bolt: '#FFC94D',
};

export const MARK = {
  // Left bubble with its tail pointing down-left.
  bubbleA:
    'M21 6 H55 A13 13 0 0 1 68 19 V42 A13 13 0 0 1 55 55 H30 L16 67 L18 54 A13 13 0 0 1 8 42 V19 A13 13 0 0 1 21 6 Z',
  // Right bubble, lower and overlapping, tail pointing down-right.
  bubbleB:
    'M45 45 H79 A13 13 0 0 1 92 58 V81 A13 13 0 0 1 82 93.5 L84 98 L70 94 H45 A13 13 0 0 1 32 81 V58 A13 13 0 0 1 45 45 Z',
  // "W" inside the left bubble, drawn as a thick stroke.
  letter: 'M19 20 L26 39 L33 26.5 L40 39 L47 20',
  // Lightning bolt inside the right bubble.
  bolt: 'M66 53 L54.5 71 H63 L59.5 85 L73.5 65 H65 L69 53 Z',
};

/** SVG markup of the mark; `bg` adds a rounded-square (or full-bleed) green background. */
export function markSvg({ size = 1024, bg = 'rounded', padding = 15 } = {}) {
  const inner = 100 - padding * 2;
  const scale = inner / 100;
  const background =
    bg === 'rounded'
      ? `<rect width="100" height="100" rx="23" fill="${BRAND.green}"/>`
      : bg === 'full'
        ? `<rect width="100" height="100" fill="${BRAND.green}"/>`
        : '';
  const gap = bg ? BRAND.green : 'none';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
${background}
<g transform="translate(${padding} ${padding}) scale(${scale})">
  <path d="${MARK.bubbleA}" fill="${BRAND.white}"/>
  <path d="${MARK.letter}" fill="none" stroke="${BRAND.green}" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="${MARK.bubbleB}" fill="${BRAND.navy}" stroke="${gap}" stroke-width="${bg ? 5 : 0}" stroke-linejoin="round"/>
  <path d="${MARK.bolt}" fill="${BRAND.bolt}"/>
</g>
</svg>`;
}
