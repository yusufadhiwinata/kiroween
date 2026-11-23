import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { namedIcons } from '../assets/images';
import { useAudioScene } from '../audio/useAudioScene';
import { Glow } from '../components/effects';
import { Screen } from '../components/Screen';
import { SubHeader } from '../components/SubHeader';
import { GText, ProgressBar } from '../components/ui';
import { ACHIEVEMENTS, COSMETICS } from '../domain/constants';
import { achievementProgress } from '../domain/progression';
import { useMotion } from '../hooks/useMotion';
import { useKeeper } from '../store/keeperStore';
import { colors } from '../theme';

export function AchievementsScreen() {
  useAudioScene('ledger');
  const { reduceMotion } = useMotion();
  const display = useKeeper(s => s.display);
  return (
    <Screen art="haunted" dim={0.75} tabs={false}>
      <SubHeader title="Achievements" subtitle={`${display.achievements.length} of ${ACHIEVEMENTS.length} unlocked`} />
      <View style={styles.grid}>
        {ACHIEVEMENTS.map((a, i) => {
          const unlocked = display.achievements.find(u => u.id === a.id);
          const progress = Math.min(a.value, achievementProgress(display, a.criteria));
          const cosmetic = a.cosmetic ? COSMETICS.find(c => c.id === a.cosmetic) : null;
          return (
            <Animated.View
              key={a.id}
              entering={reduceMotion ? undefined : FadeInDown.delay(i * 50)}
              style={[styles.card, unlocked && { borderColor: colors.gold }]}
              accessible
              accessibilityLabel={`${a.name}. ${a.description}. ${unlocked ? 'Unlocked' : `Progress ${progress} of ${a.value}`}. Reward ${a.xp} XP`}
            >
              <View style={styles.iconWrap}>
                {unlocked ? <Glow size={110} color="#FDE68A" style={{ left: -17, top: -17 }} min={0.3} max={0.6} /> : null}
                <Image source={namedIcons[a.icon]} style={[styles.icon, !unlocked && { opacity: 0.25 }]} resizeMode="contain" />
              </View>
              <GText variant="heading" style={{ textAlign: 'center' }} numberOfLines={2}>
                {a.name}
              </GText>
              <GText variant="caption" muted style={{ textAlign: 'center', marginVertical: 4 }}>
                {a.description}
              </GText>
              {unlocked ? (
                <GText variant="caption" color={colors.green} style={{ textAlign: 'center' }}>
                  {unlocked.provisional ? 'Unlocked · awaiting verification' : `Unlocked ${new Date(unlocked.unlocked_at).toLocaleDateString()}`}
                </GText>
              ) : (
                <View>
                  <ProgressBar ratio={progress / a.value} height={6} color={colors.purpleSoft} />
                  <GText variant="caption" muted style={{ textAlign: 'center', marginTop: 2 }}>
                    {progress}/{a.value}
                  </GText>
                </View>
              )}
              <GText variant="caption" color={colors.gold} style={{ textAlign: 'center', marginTop: 4 }}>
                +{a.xp} XP{cosmetic ? ` · ${cosmetic.name}` : ''}
              </GText>
            </Animated.View>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  card: { width: '48.5%', backgroundColor: colors.panel, borderRadius: 18, borderWidth: 2, borderColor: colors.panelBorder, padding: 10, marginBottom: 10 },
  iconWrap: { alignSelf: 'center', width: 76, height: 76, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  icon: { width: 70, height: 70 },
});
