import React, { useEffect, useMemo } from 'react';
import { Image, StyleSheet, View, useWindowDimensions, type ImageStyle, type StyleProp } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { images } from '../assets/images';
import { useAnimationsActive } from '../hooks/useMotion';

/** Drifting fog bank built from a tiling procedural texture. */
export function Fog({
  top,
  bottom,
  height = 220,
  opacity = 0.35,
  duration = 46000,
  reverse = false,
  tint,
}: {
  top?: number;
  bottom?: number;
  height?: number;
  opacity?: number;
  duration?: number;
  reverse?: boolean;
  tint?: string;
}) {
  const active = useAnimationsActive();
  const { width } = useWindowDimensions();
  const tile = Math.round(width * 1.8);
  const x = useSharedValue(0);
  useEffect(() => {
    if (!active) {
      cancelAnimation(x);
      return;
    }
    x.value = 0;
    x.value = withRepeat(withTiming(-tile, { duration, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(x);
  }, [active, tile, duration, x]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: reverse ? -tile - x.value : x.value }] }));
  return (
    <View pointerEvents="none" style={[styles.fogWrap, { top, bottom, height, opacity }]}>
      <Animated.View style={[{ flexDirection: 'row', width: tile * 2 }, style]}>
        <Image source={images.fxFog} style={{ width: tile, height, tintColor: tint }} resizeMode="stretch" />
        <Image source={images.fxFog} style={{ width: tile, height, tintColor: tint }} resizeMode="stretch" />
      </Animated.View>
    </View>
  );
}

/** A bat crossing the sky on a wavy path while flapping. */
function Bat({ delay, duration, y, size }: { delay: number; duration: number; y: number; size: number }) {
  const active = useAnimationsActive();
  const { width } = useWindowDimensions();
  const x = useSharedValue(-size * 2);
  const bob = useSharedValue(0);
  const flap = useSharedValue(1);
  useEffect(() => {
    if (!active) {
      [x, bob, flap].forEach(v => cancelAnimation(v));
      x.value = -size * 2;
      return;
    }
    x.value = -size * 2;
    x.value = withDelay(delay, withRepeat(withSequence(withTiming(width + size * 2, { duration, easing: Easing.linear }), withTiming(-size * 2, { duration: 0 }), withDelay(delay * 1.5, withTiming(-size * 2, { duration: 0 }))), -1, false));
    bob.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }), -1, true);
    flap.value = withRepeat(withTiming(0.55, { duration: 170 }), -1, true);
    return () => [x, bob, flap].forEach(v => cancelAnimation(v));
  }, [active, delay, duration, size, width, x, bob, flap]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y + bob.value * 22 }, { scaleY: flap.value }],
  }));
  if (!active) return null;
  return <Animated.Image source={images.bat} style={[{ position: 'absolute', width: size, height: size * 0.6 }, style]} resizeMode="contain" />;
}

export function Bats({ count = 3, top = 60 }: { count?: number; top?: number }) {
  const bats = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        delay: 1200 + i * 3100,
        duration: 9000 + i * 2300,
        y: top + i * 46,
        size: 54 - i * 10,
      })),
    [count, top],
  );
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {bats.map((b, i) => (
        <Bat key={i} {...b} />
      ))}
    </View>
  );
}

/** Pulsing glow; used for the moon halo, lanterns and flickering windows. */
export function Glow({
  size,
  color,
  style,
  flicker = false,
  min = 0.45,
  max = 0.9,
}: {
  size: number;
  color: string;
  style?: StyleProp<ImageStyle>;
  flicker?: boolean;
  min?: number;
  max?: number;
}) {
  const active = useAnimationsActive();
  const o = useSharedValue(max);
  useEffect(() => {
    if (!active) {
      cancelAnimation(o);
      o.value = max;
      return;
    }
    o.value = flicker
      ? withRepeat(
          withSequence(
            withTiming(min, { duration: 110 }),
            withTiming(max, { duration: 90 }),
            withTiming(min + (max - min) * 0.6, { duration: 260 }),
            withTiming(max * 0.95, { duration: 180 }),
            withTiming(min * 1.1, { duration: 140 }),
          ),
          -1,
          false,
        )
      : withRepeat(withTiming(min, { duration: 2600, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(o);
  }, [active, flicker, min, max, o]);
  const animated = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.Image
      pointerEvents="none"
      source={images.fxGlow}
      style={[{ position: 'absolute', width: size, height: size, tintColor: color }, style, animated]}
    />
  );
}

/** Soul wisps drifting upwards. Kept to a handful for performance. */
function Wisp({ x, delay, duration, size, color, height }: { x: number; delay: number; duration: number; size: number; color: string; height: number }) {
  const active = useAnimationsActive();
  const t = useSharedValue(0);
  useEffect(() => {
    if (!active) {
      cancelAnimation(t);
      return;
    }
    t.value = 0;
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(t);
  }, [active, delay, duration, t]);
  const style = useAnimatedStyle(() => ({
    opacity: Math.sin(t.value * Math.PI) * 0.9,
    transform: [{ translateY: height - t.value * height }, { translateX: Math.sin(t.value * Math.PI * 4) * 10 }],
  }));
  if (!active) return null;
  return (
    <Animated.View style={[{ position: 'absolute', left: x, top: 0, width: size * 3, height: size * 3, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Image source={images.fxGlow} style={{ position: 'absolute', width: size * 3, height: size * 3, tintColor: color }} />
      <View style={{ width: size, height: size, borderRadius: size, backgroundColor: color }} />
    </Animated.View>
  );
}

export function Wisps({ count = 8, colors = ['#FDE68A', '#C4B5FD', '#A7F3D0'], height = 420 }: { count?: number; colors?: string[]; height?: number }) {
  const { width } = useWindowDimensions();
  const wisps = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        x: ((i * 0.6180339 + 0.13) % 1) * (width - 30),
        delay: i * 900,
        duration: 7000 + ((i * 1371) % 5000),
        size: 3 + (i % 3),
        color: colors[i % colors.length],
      })),
    [count, width, colors],
  );
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
      {wisps.map((w, i) => (
        <Wisp key={i} {...w} height={height} />
      ))}
    </View>
  );
}

/** Gentle float used by the ghost companion and pumpkin spirit. */
export function useFloat(amplitude = 8, duration = 2400) {
  const active = useAnimationsActive();
  const v = useSharedValue(0);
  useEffect(() => {
    if (!active) {
      cancelAnimation(v);
      v.value = 0;
      return;
    }
    v.value = withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(v);
  }, [active, duration, v]);
  return useAnimatedStyle(() => ({
    transform: [{ translateY: -amplitude * v.value }, { rotate: `${(v.value - 0.5) * 6}deg` }],
  }));
}

/** Slow sway for trees and banners. */
export function useSway(degrees = 2.5, duration = 3200) {
  const active = useAnimationsActive();
  const v = useSharedValue(0);
  useEffect(() => {
    if (!active) {
      cancelAnimation(v);
      v.value = 0;
      return;
    }
    v.value = withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(v);
  }, [active, duration, v]);
  return useAnimatedStyle(() => ({ transform: [{ rotate: `${(v.value - 0.5) * 2 * degrees}deg` }] }));
}

const styles = StyleSheet.create({
  fogWrap: { position: 'absolute', left: 0, right: 0, overflow: 'hidden' },
});
