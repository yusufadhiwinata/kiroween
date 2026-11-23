import React, { useEffect } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  SlideInUp,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { images, namedIcons, regionArt } from '../assets/images';
import { audio } from '../audio/AudioEngine';
import { sfx } from '../audio/useAudioScene';
import { WORLD_AREAS, achievementById, COSMETICS } from '../domain/constants';
import type { CelebrationEvent } from '../domain/types';
import { useMotion } from '../hooks/useMotion';
import { useUi, type Toast } from '../store/uiStore';
import { colors, radii } from '../theme';
import { Fog, Glow, Wisps } from './effects';
import { GText, PrimaryButton } from './ui';

// ---------------------------------------------------------------------------
// Keeper toasts ("Great job, Keeper!")
// ---------------------------------------------------------------------------
function ToastCard({ toast }: { toast: Toast }) {
  const dismiss = useUi(s => s.dismissToast);
  const { reduceMotion } = useMotion();
  useEffect(() => {
    const t = setTimeout(() => dismiss(toast.id), toast.tone === 'error' ? 4200 : 2800);
    return () => clearTimeout(t);
  }, [toast, dismiss]);
  const error = toast.tone === 'error';
  return (
    <Animated.View entering={reduceMotion ? undefined : SlideInUp.springify().damping(16)} exiting={reduceMotion ? undefined : FadeOut} style={[styles.toast, error && styles.toastError]}>
      <Pressable onPress={() => dismiss(toast.id)} style={styles.toastInner} accessibilityRole="alert" accessibilityLabel={`${toast.title}. ${toast.message ?? ''}`}>
        <Image source={images.keeperAvatar} style={styles.toastAvatar} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.toastTitle, error && { color: '#7F1D1D' }]}>{toast.title}</Text>
          {toast.message ? <Text style={styles.toastMsg}>{toast.message}</Text> : null}
        </View>
        {toast.xp ? <Text style={styles.toastXp}>+{toast.xp} XP</Text> : null}
      </Pressable>
    </Animated.View>
  );
}

export function ToastHost() {
  const toasts = useUi(s => s.toasts);
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[styles.toastHost, { top: insets.top + 8 }]}>
      {toasts.map(t => (
        <ToastCard key={t.id} toast={t} />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Cinematic celebrations (level up, achievement reveal, region unlock/restore)
// ---------------------------------------------------------------------------
function Rays({ color }: { color: string }) {
  const { reduceMotion } = useMotion();
  const r = useSharedValue(0);
  useEffect(() => {
    if (!reduceMotion) r.value = withRepeat(withTiming(360, { duration: 16000, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(r);
  }, [reduceMotion, r]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value}deg` }] }));
  return (
    <Animated.View pointerEvents="none" style={[styles.rays, style]}>
      {Array.from({ length: 12 }, (_, i) => (
        <View key={i} style={[styles.ray, { backgroundColor: color, transform: [{ rotate: `${i * 30}deg` }] }]} />
      ))}
    </Animated.View>
  );
}

function describe(event: CelebrationEvent) {
  switch (event.kind) {
    case 'level':
      return { kicker: 'Level Up', title: `Level ${event.level}`, body: 'Your lantern burns brighter. New corners of Graveyard may awaken.', image: images.pumpkin, color: colors.gold, sound: 'reward' as const };
    case 'achievement': {
      const a = achievementById(event.id);
      const cosmetic = a?.cosmetic ? COSMETICS.find(c => c.id === a.cosmetic)?.name : null;
      return {
        kicker: 'Achievement Unlocked',
        title: a?.name ?? 'Achievement',
        body: `${a?.description ?? ''}${a ? `  +${a.xp} XP` : ''}${cosmetic ? `\nCosmetic unlocked: ${cosmetic}` : ''}`,
        image: namedIcons[a?.icon ?? 'ach_star'] ?? images.chestBig,
        color: colors.purpleSoft,
        sound: 'achievement' as const,
      };
    }
    case 'region_unlocked': {
      const area = WORLD_AREAS.find(w => w.id === event.areaId);
      return { kicker: 'A Region Awakens', title: area?.name ?? 'New region', body: area?.description ?? '', image: regionArt[event.areaId as keyof typeof regionArt], color: colors.blue, sound: 'doorCreak' as const, art: true };
    }
    case 'region_restored': {
      const area = WORLD_AREAS.find(w => w.id === event.areaId);
      return { kicker: 'Region Restored', title: area?.name ?? 'Region', body: 'Light returns. The souls here rest peacefully again.', image: regionArt[event.areaId as keyof typeof regionArt], color: colors.green, sound: 'spell' as const, art: true };
    }
  }
}

export function CelebrationHost() {
  const current = useUi(s => s.celebrations[0]);
  const shift = useUi(s => s.shiftCelebration);
  const { reduceMotion } = useMotion();
  const pop = useSharedValue(0);
  const fogOpacity = useSharedValue(0.9);

  useEffect(() => {
    if (!current) {
      audio.popOverlay();
      return;
    }
    audio.pushOverlay('achievement');
    const d = describe(current);
    sfx(d.sound, { restart: true });
    pop.value = 0;
    fogOpacity.value = 0.9;
    pop.value = reduceMotion ? 1 : withSequence(withTiming(0, { duration: 80 }), withSpring(1, { damping: 9, stiffness: 120 }));
    fogOpacity.value = reduceMotion ? 0 : withTiming(0, { duration: 1800 });
  }, [current, reduceMotion, pop, fogOpacity]);

  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: 0.4 + pop.value * 0.6 }, { rotate: `${(1 - pop.value) * -20}deg` }], opacity: pop.value }));
  const fogStyle = useAnimatedStyle(() => ({ opacity: fogOpacity.value }));

  if (!current) return null;
  const d = describe(current);
  return (
    <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(250)} exiting={reduceMotion ? undefined : FadeOut.duration(200)} style={styles.celebration} accessibilityViewIsModal>
      <Rays color={d.color} />
      {!reduceMotion ? <Wisps count={10} height={700} /> : null}
      <View style={styles.celebrationCard}>
        <GText variant="label" color={d.color} style={{ textAlign: 'center' }}>
          {d.kicker}
        </GText>
        <Animated.View style={[styles.celebrationArt, popStyle]}>
          <Glow size={240} color={d.color} style={{ left: -30, top: -30 }} min={0.5} max={0.95} />
          {'art' in d && d.art ? (
            <View style={styles.regionReveal}>
              <Image source={d.image} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              <Animated.View style={[StyleSheet.absoluteFill, fogStyle]}>
                <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0B0A1A', opacity: 0.6 }]} />
                <Fog bottom={0} height={180} opacity={0.9} duration={12000} />
              </Animated.View>
            </View>
          ) : (
            <Image source={d.image} style={{ width: 170, height: 170 }} resizeMode="contain" />
          )}
        </Animated.View>
        <GText variant="display" style={{ textAlign: 'center' }} accessibilityRole="header">
          {d.title}
        </GText>
        <GText variant="body" muted style={{ textAlign: 'center', marginTop: 8, marginBottom: 20 }}>
          {d.body}
        </GText>
        <PrimaryButton label="Continue" sound="menu" onPress={shift} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toastHost: { position: 'absolute', left: 12, right: 12, zIndex: 50 },
  toast: {
    backgroundColor: colors.parchment,
    borderRadius: radii.lg,
    borderWidth: 3,
    borderColor: '#C9A86A',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  toastError: { borderColor: colors.red, backgroundColor: '#FDE2E2' },
  toastInner: { flexDirection: 'row', alignItems: 'center', padding: 10, minHeight: 56 },
  toastAvatar: { width: 46, height: 46, marginRight: 10 },
  toastTitle: { color: colors.parchmentInk, fontWeight: '900', fontSize: 15 },
  toastMsg: { color: colors.parchmentInk, fontWeight: '600', fontSize: 13, marginTop: 2 },
  toastXp: { color: '#92400E', fontWeight: '900', fontSize: 16, marginLeft: 8 },
  celebration: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(5,4,15,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 60,
    padding: 24,
  },
  rays: { position: 'absolute', width: 900, height: 900, alignItems: 'center', justifyContent: 'center', opacity: 0.12 },
  ray: { position: 'absolute', width: 900, height: 26 },
  celebrationCard: { width: '100%', maxWidth: 420, alignItems: 'stretch' },
  celebrationArt: { alignSelf: 'center', width: 180, height: 180, alignItems: 'center', justifyContent: 'center', marginVertical: 18 },
  regionReveal: { width: 180, height: 180, borderRadius: radii.lg, overflow: 'hidden', borderWidth: 3, borderColor: colors.gold },
});
