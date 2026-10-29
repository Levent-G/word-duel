import { Text, View } from 'react-native';
import Svg, { G, Path, Rect } from 'react-native-svg';

import { BRAND, MARK } from '../brand/mark';
import { fonts } from '../theme';

const PAD = 15;
const SCALE = (100 - PAD * 2) / 100;

export function LogoMark({ size = 40 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityLabel="Word Duel logosu">
      <Rect width="100" height="100" rx="23" fill={BRAND.green} />
      <G transform={`translate(${PAD} ${PAD}) scale(${SCALE})`}>
        <Path d={MARK.bubbleA} fill={BRAND.white} />
        <Path
          d={MARK.letter}
          fill="none"
          stroke={BRAND.green}
          strokeWidth={6.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path d={MARK.bubbleB} fill={BRAND.navy} stroke={BRAND.green} strokeWidth={5} strokeLinejoin="round" />
        <Path d={MARK.bolt} fill={BRAND.bolt} />
      </G>
    </Svg>
  );
}

/** Mark plus the "Word Duel" wordmark, with "Duel" in green. */
export function Logo({ size = 36 }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.28 }}>
      <LogoMark size={size} />
      <Text style={{ fontFamily: fonts.extrabold, fontSize: size * 0.5, color: BRAND.navy, letterSpacing: -0.3 }}>
        Word <Text style={{ color: BRAND.green }}>Duel</Text>
      </Text>
    </View>
  );
}
