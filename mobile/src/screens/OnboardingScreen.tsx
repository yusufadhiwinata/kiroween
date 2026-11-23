import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { images } from '../assets/images';
import { audio } from '../audio/AudioEngine';
import { sfx } from '../audio/useAudioScene';
import { HauntedBackground, type SceneArt } from '../components/HauntedBackground';
import { GText, GhostButton, PrimaryButton, ToggleRow } from '../components/ui';
import { useMotion } from '../hooks/useMotion';
import { useSettings } from '../store/settingsStore';
import { colors } from '../theme';

const PAGES: { art: SceneArt; image: number; title: string; body: string }[] = [
  {
    art: 'day',
    image: images.logo,
    title: 'Once, Graveyard glowed.',
    body: 'A world of light, guardian spirits and warm lanterns. Every soul had a home.',
  },
  {
    art: 'night',
    image: images.ghost,
    title: 'Then the Soul Energy faded.',
    body: 'The village lost its light. Fog swallowed the woods. The castle fell asleep.',
  },
  {
    art: 'haunted',
    image: images.darkKeeper,
    title: 'You are the last Keeper.',
    body: 'Every quest, ritual and focus session returns Soul Energy and awakens the world. The Dark Keeper will guide you.',
  },
];

export function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { reduceMotion, systemReduceMotion } = useMotion();
  const update = useSettings(s => s.update);
  const appReduce = useSettings(s => s.reduceMotion);
  const [page, setPage] = useState(0);
  const isSoundPage = page === PAGES.length;
  const current = PAGES[Math.min(page, PAGES.length - 1)];

  useEffect(() => {
    audio.setScene('splash');
  }, []);

  const finish = (sound: boolean) => {
    update({ soundEnabled: sound, soundIntroDone: true, onboardingDone: true });
    if (sound) setTimeout(() => sfx('magicTransition'), 300);
  };

  return (
    <View style={{ flex: 1 }}>
      <HauntedBackground art={isSoundPage ? 'haunted' : current.art} dim={0.5} />
      <View style={[styles.content, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
        <Animated.View key={page} entering={reduceMotion ? undefined : FadeIn.duration(500)} exiting={reduceMotion ? undefined : FadeOut.duration(200)} style={styles.page}>
          {isSoundPage ? (
            <>
              <Image source={images.iconMusic} style={styles.image} resizeMode="contain" />
              <GText variant="display" style={styles.center} accessibilityRole="header">
                May the Graveyard sing?
              </GText>
              <GText variant="body" muted style={[styles.center, { marginTop: 10 }]}>
                Music, ambience and spooky effects follow you through every screen. Sound is optional and never needed to use the app. Change it anytime in Settings.
              </GText>
              <View style={styles.motionBox}>
                <ToggleRow
                  label="Reduce Motion"
                  hint={systemReduceMotion ? 'Your device already asks for reduced motion.' : 'Calmer screens with fewer moving effects.'}
                  value={appReduce || systemReduceMotion}
                  onChange={v => update({ reduceMotion: v })}
                />
              </View>
            </>
          ) : (
            <>
              <Image source={current.image} style={styles.image} resizeMode="contain" />
              <GText variant="display" style={styles.center} accessibilityRole="header">
                {current.title}
              </GText>
              <GText variant="body" muted style={[styles.center, { marginTop: 10, fontSize: 16 }]}>
                {current.body}
              </GText>
            </>
          )}
        </Animated.View>
        <View style={styles.dots}>
          {[...PAGES, null].map((_, i) => (
            <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
          ))}
        </View>
        {isSoundPage ? (
          <View style={{ gap: 10 }}>
            <PrimaryButton label="Enable sound" icon="♪" sound={null} onPress={() => finish(true)} />
            <GhostButton label="Stay silent" sound={null} onPress={() => finish(false)} />
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            <PrimaryButton label={page === PAGES.length - 1 ? 'Become the Keeper' : 'Next'} sound={null} onPress={() => setPage(p => p + 1)} />
            <GhostButton label="Skip story" sound={null} onPress={() => setPage(PAGES.length)} />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, paddingHorizontal: 24, justifyContent: 'space-between' },
  page: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  image: { width: 220, height: 180, marginBottom: 24 },
  center: { textAlign: 'center' },
  motionBox: { alignSelf: 'stretch', marginTop: 24, backgroundColor: colors.panel, borderRadius: 16, paddingHorizontal: 14, borderWidth: 2, borderColor: colors.panelBorder },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginVertical: 18 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.textFaint },
  dotActive: { width: 24, backgroundColor: colors.gold },
});
