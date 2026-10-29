import { Feather } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';

import { listenConnected } from '../online/api';
import { onlineConfigured } from '../online/firebase';
import { colors, fonts } from '../theme';

/** Brief losses (under 2 s) are ignored so the bar does not flicker on flaky networks. */
const SHOW_AFTER_MS = 2000;

export default function ConnectionBanner() {
  const [offline, setOffline] = useState(false);
  const everConnected = useRef(false);
  const height = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!onlineConfigured) return undefined;
    let timer = null;
    const stop = listenConnected((up) => {
      clearTimeout(timer);
      if (up) {
        everConnected.current = true;
        setOffline(false);
      } else if (everConnected.current) {
        timer = setTimeout(() => setOffline(true), SHOW_AFTER_MS);
      }
    });
    return () => {
      clearTimeout(timer);
      stop();
    };
  }, []);

  useEffect(() => {
    Animated.timing(height, { toValue: offline ? 30 : 0, duration: 200, useNativeDriver: false }).start();
  }, [offline, height]);

  if (!onlineConfigured) return null;
  return (
    <Animated.View style={[st.bar, { height }]} accessibilityLiveRegion="polite">
      {offline ? (
        <>
          <Feather name="wifi-off" size={14} color="#FFFFFF" />
          <Text style={st.text}>Bağlantı yok · yeniden bağlanılıyor…</Text>
        </>
      ) : null}
    </Animated.View>
  );
}

const st = StyleSheet.create({
  bar: {
    backgroundColor: colors.red,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    overflow: 'hidden',
  },
  text: { fontFamily: fonts.semibold, fontSize: 13, color: '#FFFFFF' },
});
