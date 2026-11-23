import React from 'react';
import { Image, type ImageSourcePropType, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { images } from '../assets/images';
import { Bats, Fog, Glow, Wisps } from './effects';
import { colors } from '../theme';
import { useMotion } from '../hooks/useMotion';

export type SceneArt = 'night' | 'haunted' | 'dusk' | 'day';

const ART: Record<SceneArt, ImageSourcePropType> = {
  night: images.sceneNight,
  haunted: images.sceneHaunted,
  dusk: images.sceneDusk,
  day: images.sceneDay,
};

/** World restoration (0..1) decides how bright the Graveyard looks. */
export function sceneForRestoration(r: number): SceneArt {
  if (r < 0.2) return 'night';
  if (r < 0.5) return 'haunted';
  if (r < 0.85) return 'dusk';
  return 'day';
}

export function HauntedBackground({
  art = 'night',
  dim = 0.45,
  fog = true,
  bats = true,
  wisps = true,
  moon = true,
  children,
}: {
  art?: SceneArt;
  dim?: number;
  fog?: boolean;
  bats?: boolean;
  wisps?: boolean;
  moon?: boolean;
  children?: React.ReactNode;
}) {
  const { reduceMotion } = useMotion();
  const night = art === 'night' || art === 'haunted';
  return (
    <View style={styles.root}>
      <Animated.View key={art} entering={reduceMotion ? undefined : FadeIn.duration(900)} style={StyleSheet.absoluteFill}>
        <Image source={ART[art]} style={styles.art} resizeMode="cover" blurRadius={1} />
      </Animated.View>
      {moon && night ? <Glow size={260} color="#FDF4C4" style={{ top: -40, right: -50 }} min={0.25} max={0.55} /> : null}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.night, opacity: dim }]} />
      <View style={[styles.bottomShade]} />
      {fog ? (
        <>
          <Fog top={90} height={200} opacity={night ? 0.22 : 0.14} duration={60000} />
          <Fog bottom={40} height={260} opacity={night ? 0.32 : 0.18} duration={42000} reverse />
        </>
      ) : null}
      {bats && night ? <Bats count={3} top={70} /> : null}
      {wisps ? <Wisps count={7} height={520} /> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.night, overflow: 'hidden' },
  art: { width: '100%', height: '100%' },
  bottomShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '45%',
    backgroundColor: colors.night,
    opacity: 0.55,
  },
});
