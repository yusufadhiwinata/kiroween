import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { images } from '../assets/images';
import { COSMETICS } from '../domain/constants';
import { useAnimationsActive } from '../hooks/useMotion';
import { colors } from '../theme';
import { Glow, useFloat } from './effects';
import { sfx } from '../audio/useAudioScene';

export type KeeperMood = 'idle' | 'thinking' | 'talking' | 'celebrating' | 'error';

const MOOD_GLOW: Record<KeeperMood, string> = {
  idle: '#8B5CF6',
  thinking: '#60A5FA',
  talking: '#FBBF24',
  celebrating: '#FDE68A',
  error: '#EF4444',
};

/** Dark Keeper with a small state machine of animated moods. */
export function DarkKeeper({ mood, size = 150 }: { mood: KeeperMood; size?: number }) {
  const active = useAnimationsActive();
  const y = useSharedValue(0);
  const x = useSharedValue(0);
  const s = useSharedValue(1);
  const r = useSharedValue(0);

  useEffect(() => {
    [y, x, s, r].forEach(v => cancelAnimation(v));
    y.value = 0;
    x.value = 0;
    s.value = 1;
    r.value = 0;
    if (!active) return;
    switch (mood) {
      case 'idle':
        s.value = withRepeat(withTiming(1.035, { duration: 2200, easing: Easing.inOut(Easing.sin) }), -1, true);
        break;
      case 'thinking':
        r.value = withRepeat(withSequence(withTiming(-3, { duration: 500 }), withTiming(3, { duration: 500 })), -1, true);
        y.value = withRepeat(withTiming(-4, { duration: 700 }), -1, true);
        break;
      case 'talking':
        y.value = withRepeat(withSequence(withTiming(-5, { duration: 160 }), withTiming(0, { duration: 180 })), -1, false);
        break;
      case 'celebrating':
        y.value = withRepeat(withSequence(withSpring(-22, { damping: 6 }), withTiming(0, { duration: 260 })), 3, false);
        s.value = withSequence(withSpring(1.12), withTiming(1, { duration: 600 }));
        break;
      case 'error':
        x.value = withSequence(...[10, -10, 8, -8, 4, 0].map(v => withTiming(v, { duration: 70 })));
        break;
    }
    return () => [y, x, s, r].forEach(v => cancelAnimation(v));
  }, [mood, active, y, x, s, r]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: s.value }, { rotate: `${r.value}deg` }],
  }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel={`Dark Keeper, ${mood}`} accessible>
      <Glow size={size * 1.3} color={MOOD_GLOW[mood]} style={{ left: -size * 0.15, top: -size * 0.15 }} flicker={mood === 'thinking' || mood === 'error'} min={0.35} max={0.85} />
      <Animated.Image source={images.darkKeeper} style={[{ width: size, height: size }, style]} resizeMode="contain" />
      {mood === 'thinking' ? <ThinkingDots /> : null}
    </View>
  );
}

function ThinkingDots() {
  const active = useAnimationsActive();
  const t = useSharedValue(0);
  useEffect(() => {
    if (active) t.value = withRepeat(withTiming(3, { duration: 1200, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(t);
  }, [active, t]);
  const d0 = useAnimatedStyle(() => ({ opacity: Math.floor(t.value) === 0 ? 1 : 0.3 }));
  const d1 = useAnimatedStyle(() => ({ opacity: Math.floor(t.value) === 1 ? 1 : 0.3 }));
  const d2 = useAnimatedStyle(() => ({ opacity: Math.floor(t.value) === 2 ? 1 : 0.3 }));
  const styles0 = [d0, d1, d2];
  return (
    <View style={styles.dots}>
      {styles0.map((st, i) => (
        <Animated.View key={i} style={[styles.dot, st]} />
      ))}
    </View>
  );
}

const GHOST_TIPS = [
  'Boo! Small quests still light big lanterns.',
  'Finish one ritual and the fog thins a little.',
  'Boss quests are worth 100 XP. Slay one this week?',
  'A 25-minute focus candle earns 25 Soul Energy.',
  'The Dark Keeper can break big goals into small quests.',
];

/** Floating ghost companion; tap for a tip. */
export function GhostCompanion({ size = 74 }: { size?: number }) {
  const float = useFloat(9, 2600);
  const [tip, setTip] = useState<string | null>(null);
  useEffect(() => {
    if (!tip) return;
    const t = setTimeout(() => setTip(null), 3800);
    return () => clearTimeout(t);
  }, [tip]);
  return (
    <View style={{ alignItems: 'center' }}>
      {tip ? (
        <View style={styles.tip} accessibilityLiveRegion="polite">
          <Text style={styles.tipText}>{tip}</Text>
        </View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ghost companion. Tap for a tip"
        hitSlop={12}
        onPress={() => {
          sfx('ghost');
          setTip(GHOST_TIPS[Math.floor(Math.random() * GHOST_TIPS.length)]);
        }}
      >
        <Animated.Image source={images.ghost} style={[{ width: size, height: size * 1.15 }, float]} resizeMode="contain" />
      </Pressable>
    </View>
  );
}

/** Keeper portrait with the equipped cosmetic aura. */
export function KeeperPortrait({ size = 64, cosmetic = 'default' }: { size?: number; cosmetic?: string }) {
  const c = COSMETICS.find(x => x.id === cosmetic) ?? COSMETICS[0];
  return (
    <View style={{ width: size, height: size }}>
      {cosmetic !== 'default' ? <Glow size={size * 1.5} color={c.glow} style={{ left: -size * 0.25, top: -size * 0.25 }} min={0.5} max={0.9} /> : null}
      <Image
        source={images.keeperAvatar}
        style={[{ width: size, height: size, borderRadius: size / 2 }, cosmetic !== 'default' && { borderWidth: 3, borderColor: c.ring }]}
        resizeMode="contain"
        accessibilityLabel="Keeper avatar"
      />
      {cosmetic === 'crown_gold' ? (
        <Text style={{ position: 'absolute', top: -size * 0.28, alignSelf: 'center', fontSize: size * 0.34 }}>👑</Text>
      ) : null}
    </View>
  );
}

/** Row of ritual candles; extinguished candles dim and lose their flame glow. */
export function CandleRow({ total = 6, lit, height = 72, flicker = true }: { total?: number; lit: number; height?: number; flicker?: boolean }) {
  const width = height * 0.44;
  return (
    <View style={styles.candles} accessible accessibilityLabel={`${lit} of ${total} candles lit`}>
      {Array.from({ length: total }, (_, i) => {
        const on = i < lit;
        return (
          <View key={i} style={{ width, height, marginHorizontal: 3 }}>
            {on ? <Glow size={width * 2.2} color="#FFB347" flicker={flicker} style={{ left: -width * 0.6, top: -width * 0.75 }} min={0.4} max={0.95} /> : null}
            <Image
              source={images.candles[i % images.candles.length]}
              style={{ width, height, opacity: on ? 1 : 0.35, tintColor: on ? undefined : '#3b3560' }}
              resizeMode="contain"
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  dots: { position: 'absolute', bottom: -6, flexDirection: 'row', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.blue },
  tip: {
    maxWidth: 220,
    backgroundColor: colors.parchment,
    borderRadius: 14,
    padding: 10,
    marginBottom: 6,
    borderWidth: 2,
    borderColor: '#C9A86A',
  },
  tipText: { color: colors.parchmentInk, fontWeight: '700', fontSize: 13 },
  candles: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center' },
});
