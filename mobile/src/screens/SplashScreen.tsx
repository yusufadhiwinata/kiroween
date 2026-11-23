import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { images } from '../assets/images';
import { audio } from '../audio/AudioEngine';
import { sfx } from '../audio/useAudioScene';
import { HauntedBackground } from '../components/HauntedBackground';
import { Glow } from '../components/effects';
import { GText } from '../components/ui';
import { useMotion } from '../hooks/useMotion';
import { colors } from '../theme';

/** Cinematic intro: moon reveal, bats, fog and the animated GRAVEYARD logo. */
export function SplashScreen({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const { width } = useWindowDimensions();
  const { reduceMotion } = useMotion();
  const moonY = useSharedValue(reduceMotion ? 0 : 160);
  const moonO = useSharedValue(reduceMotion ? 1 : 0);
  const logoS = useSharedValue(reduceMotion ? 1 : 0.6);
  const logoO = useSharedValue(reduceMotion ? 1 : 0);
  const tagO = useSharedValue(reduceMotion ? 1 : 0);
  const [minElapsed, setMinElapsed] = React.useState(false);

  useEffect(() => {
    audio.setScene('splash');
    if (!reduceMotion) {
      moonY.value = withTiming(0, { duration: 1600, easing: Easing.out(Easing.cubic) });
      moonO.value = withTiming(1, { duration: 1200 });
      logoO.value = withDelay(700, withTiming(1, { duration: 600 }));
      logoS.value = withDelay(700, withSpring(1, { damping: 8, stiffness: 90 }));
      tagO.value = withDelay(1500, withTiming(1, { duration: 700 }));
    }
    const bat = setTimeout(() => sfx('batFlap'), 600);
    const t = setTimeout(() => setMinElapsed(true), reduceMotion ? 900 : 2800);
    return () => {
      clearTimeout(t);
      clearTimeout(bat);
    };
  }, [reduceMotion, moonY, moonO, logoO, logoS, tagO]);

  useEffect(() => {
    if (ready && minElapsed) onDone();
  }, [ready, minElapsed, onDone]);

  const moonStyle = useAnimatedStyle(() => ({ opacity: moonO.value, transform: [{ translateY: moonY.value }] }));
  const logoStyle = useAnimatedStyle(() => ({ opacity: logoO.value, transform: [{ scale: logoS.value }] }));
  const tagStyle = useAnimatedStyle(() => ({ opacity: tagO.value }));
  const logoW = Math.min(width * 0.86, 420);

  return (
    <Pressable style={{ flex: 1 }} onPress={() => ready && onDone()} accessibilityLabel="Graveyard. Every task awakens a forgotten soul. Tap to enter">
      <HauntedBackground art="night" dim={0.35} moon={false}>
        <Animated.View style={[styles.moon, moonStyle]}>
          <Glow size={320} color="#FDF4C4" style={{ left: -100, top: -100 }} min={0.45} max={0.8} />
          <View style={styles.moonDisc} />
        </Animated.View>
      </HauntedBackground>
      <View style={styles.center} pointerEvents="none">
        <Animated.Image source={images.logo} style={[{ width: logoW, height: logoW * 0.55 }, logoStyle]} resizeMode="contain" />
        <Animated.View style={tagStyle}>
          <GText variant="heading" color={colors.parchment} style={styles.tagline}>
            Every Task Awakens a Forgotten Soul.
          </GText>
          <GText variant="caption" muted style={{ textAlign: 'center', marginTop: 18 }}>
            {ready ? 'Tap to enter' : 'Summoning your Graveyard…'}
          </GText>
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  moon: { position: 'absolute', top: 90, right: 46, width: 120, height: 120 },
  moonDisc: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#FFF7D6', opacity: 0.95 },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', padding: 24 },
  tagline: { textAlign: 'center', marginTop: 12, fontStyle: 'italic' },
});
