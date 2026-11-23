import React from 'react';
import { Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { images, regionArt } from '../assets/images';
import { useAudioScene } from '../audio/useAudioScene';
import { Fog, Glow, Wisps } from '../components/effects';
import { RegionCard, STATE_LABEL, STATE_SHADE, StateChip } from '../components/game';
import { Screen } from '../components/Screen';
import { SubHeader } from '../components/SubHeader';
import { GText, Panel, ProgressBar } from '../components/ui';
import { WORLD_AREAS } from '../domain/constants';
import type { RegionState } from '../domain/types';
import { useProgress } from '../hooks/useKeeperData';
import { useMotion } from '../hooks/useMotion';
import type { RootScreenProps, RootStackParamList, TabParamList } from '../navigation/types';
import { colors, stateColors } from '../theme';

type Props = CompositeScreenProps<BottomTabScreenProps<TabParamList, 'World'>, NativeStackScreenProps<RootStackParamList>>;

export function WorldScreen({ navigation }: Props) {
  useAudioScene('world');
  const { width } = useWindowDimensions();
  const { reduceMotion } = useMotion();
  const { display, restoration, level } = useProgress();
  const cardW = (Math.min(width, 520) - 16 * 2 - 12) / 2;
  return (
    <Screen art="night" dim={0.55} bats title="World of Graveyard" subtitle="Soul Energy from every reward restores the regions in order.">
      <Panel title="Graveyard restoration" icon={images.logo} right={<GText variant="heading" color={colors.gold}>{Math.round(restoration * 100)}%</GText>}>
        <ProgressBar ratio={restoration} color={colors.green} />
        <GText variant="caption" muted style={{ marginTop: 6 }}>
          Keeper level {level.level} · {display.stats.soul_energy} Soul Energy gathered
        </GText>
      </Panel>
      <View style={styles.grid}>
        {display.world.map((w, i) => (
          <Animated.View key={w.area_id} entering={reduceMotion ? undefined : FadeInDown.delay(i * 90)}>
            <RegionCard progress={w} width={cardW} onPress={() => navigation.navigate('Region', { areaId: w.area_id })} />
          </Animated.View>
        ))}
      </View>
    </Screen>
  );
}

const LADDER: RegionState[] = ['locked', 'abandoned', 'awakening', 'restoration', 'restored'];

export function RegionScreen({ route }: RootScreenProps<'Region'>) {
  useAudioScene('world');
  const { width } = useWindowDimensions();
  const { display, level } = useProgress();
  const area = WORLD_AREAS.find(a => a.id === route.params.areaId) ?? WORLD_AREAS[0];
  const progress = display.world.find(w => w.area_id === area.id);
  const state = progress?.state ?? 'locked';
  const ratio = progress ? progress.points / progress.required : 0;
  const artH = Math.min(width - 32, 420);
  const stepIndex = LADDER.indexOf(state);
  return (
    <Screen art="night" dim={0.7} tabs={false}>
      <SubHeader title={area.name} subtitle={STATE_LABEL[state]} />
      <View style={[styles.art, { height: artH, borderColor: stateColors[state] }]}>
        <Image source={regionArt[area.id]} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#05040F', opacity: STATE_SHADE[state] }]} />
        {state !== 'restored' ? <Fog bottom={0} height={artH * 0.55} opacity={0.25 + STATE_SHADE[state] * 0.4} duration={26000} /> : null}
        {state === 'restored' || state === 'restoration' ? <Wisps count={6} height={artH} colors={['#FDE68A', '#A7F3D0']} /> : null}
        {state === 'restored' ? <Glow size={artH * 0.9} color="#FDE68A" style={{ left: (width - 32) / 2 - artH * 0.45, top: artH * 0.05 }} min={0.15} max={0.35} /> : null}
        {state === 'locked' ? <GText style={styles.lock}>🔒</GText> : null}
      </View>
      <Panel>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <StateChip state={state} />
          <GText variant="body" muted style={{ marginLeft: 10 }}>
            {state === 'locked' ? `Unlocks at level ${area.unlockLevel} (you are ${level.level})` : `${progress?.points ?? 0} / ${area.restorePoints} Soul Energy`}
          </GText>
        </View>
        {state !== 'locked' ? <ProgressBar ratio={ratio} color={stateColors[state]} /> : null}
        <GText variant="body" style={{ marginTop: 12 }}>
          {area.lore}
        </GText>
      </Panel>
      <Panel title="Restoration path">
        {LADDER.map((s, i) => (
          <View key={s} style={styles.step} accessible accessibilityLabel={`${STATE_LABEL[s]}${i === stepIndex ? ', current' : i < stepIndex ? ', passed' : ''}`}>
            <View style={[styles.stepDot, { backgroundColor: i <= stepIndex ? stateColors[s] : 'transparent', borderColor: stateColors[s] }]} />
            <GText variant="body" style={{ fontWeight: i === stepIndex ? '900' : '600' }} color={i === stepIndex ? colors.gold : i < stepIndex ? colors.text : colors.textFaint}>
              {STATE_LABEL[s]}
            </GText>
            <GText variant="caption" muted style={{ marginLeft: 'auto' }}>
              {s === 'locked' ? `Lv. ${area.unlockLevel}` : s === 'abandoned' ? '0%' : s === 'awakening' ? '25%' : s === 'restoration' ? '60%' : '100%'}
            </GText>
          </View>
        ))}
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  art: { borderRadius: 20, overflow: 'hidden', borderWidth: 3, marginBottom: 14 },
  lock: { position: 'absolute', alignSelf: 'center', top: '42%', fontSize: 48 },
  step: { flexDirection: 'row', alignItems: 'center', minHeight: 40, gap: 10 },
  stepDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 3 },
});
