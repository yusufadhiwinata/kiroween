import React, { useMemo } from 'react';
import { Image, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { images, regionArt } from '../assets/images';
import { useAudioScene } from '../audio/useAudioScene';
import { CandleRow, GhostCompanion, KeeperPortrait } from '../components/characters';
import { Glow, useSway } from '../components/effects';
import { LevelPill, QuestRow, SoulEnergyBar, StateChip } from '../components/game';
import { HauntedBackground, sceneForRestoration } from '../components/HauntedBackground';
import { TAB_BAR_SPACE } from '../components/Screen';
import { GText, Panel, PressableScale, PrimaryButton, ProgressBar, SecondaryButton } from '../components/ui';
import { WORLD_AREAS } from '../domain/constants';
import { greeting } from '../domain/dates';
import { useMotion } from '../hooks/useMotion';
import { isDoneThisPeriod, useCompletionActions, useOpenQuests, useProgress, useTodayRituals } from '../hooks/useKeeperData';
import type { RootStackParamList, TabParamList } from '../navigation/types';
import { useKeeper } from '../store/keeperStore';
import { useSession } from '../store/sessionStore';
import { useSettings } from '../store/settingsStore';
import { colors, stateColors } from '../theme';

type Props = CompositeScreenProps<BottomTabScreenProps<TabParamList, 'Home'>, NativeStackScreenProps<RootStackParamList>>;

function GroundDecor() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const sway = useSway(2, 3600);
  const h = (width * 129) / 750;
  return (
    <View pointerEvents="none" style={[styles.ground, { bottom: TAB_BAR_SPACE - 34 + insets.bottom, height: h }]}>
      <Image source={images.decoGround} style={{ width, height: h, opacity: 0.85 }} resizeMode="stretch" />
      {/* Lantern flames on the cemetery gate */}
      <Glow size={h * 0.7} color="#FFB347" flicker style={{ left: (26 / 750) * width - h * 0.35, top: (56 / 129) * h - h * 0.35 }} />
      <Glow size={h * 0.7} color="#FFB347" flicker style={{ left: (201 / 750) * width - h * 0.35, top: (56 / 129) * h - h * 0.35 }} />
      <Animated.Image source={images.decoTree} style={[styles.tree, { height: h * 1.25, width: h * 1.28, right: -h * 0.15, bottom: h * 0.05 }, sway]} resizeMode="contain" />
    </View>
  );
}

export function HomeScreen({ navigation }: Props) {
  useAudioScene('home');
  const insets = useSafeAreaInsets();
  const { reduceMotion } = useMotion();
  const name = useKeeper(s => s.displayName);
  const pendingOps = useKeeper(s => s.pendingOps);
  const sync = useKeeper(s => s.sync);
  const history = useKeeper(s => s.history);
  const status = useSession(s => s.status);
  const cosmetic = useSettings(s => s.equippedCosmetic);
  const { display, level, region, restoration } = useProgress();
  const open = useOpenQuests();
  const rituals = useTodayRituals();
  const { onCompleteQuest } = useCompletionActions();
  const area = WORLD_AREAS.find(a => a.id === region?.area_id) ?? WORLD_AREAS[0];

  const tip = useMemo(() => {
    const overdue = open.filter(q => q.deadline && new Date(q.deadline).getTime() < Date.now()).length;
    const ritualsLeft = rituals.due.length - rituals.doneCount;
    if (open.length === 0 && rituals.all.length === 0) return 'The cemetery is quiet. Create your first quest to awaken a soul.';
    if (overdue > 0) return `${overdue} quest${overdue > 1 ? 's are' : ' is'} fading past the deadline. Shall we face ${overdue > 1 ? 'them' : 'it'}?`;
    if (ritualsLeft > 0) return `${ritualsLeft} ritual candle${ritualsLeft > 1 ? 's still wait' : ' still waits'} to be lit today.`;
    if (open.length === 0) return 'Every quest is complete. The graveyard is getting brighter.';
    return 'Great job, Keeper! The graveyard is getting brighter.';
  }, [open, rituals]);

  const syncLabel =
    status === 'guest'
      ? 'Offline Keeper'
      : !sync.online
        ? `Offline · ${pendingOps} waiting`
        : sync.running
          ? 'Syncing…'
          : pendingOps > 0
            ? `${pendingOps} to sync`
            : 'Verified';
  const litCandles = rituals.due.length ? Math.round((rituals.doneCount / rituals.due.length) * 6) : 0;
  const enter = (i: number) => (reduceMotion ? undefined : FadeInDown.delay(80 * i).duration(450));

  return (
    <View style={styles.root}>
      <HauntedBackground art={sceneForRestoration(restoration)} dim={0.3}>
        <GroundDecor />
      </HauntedBackground>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: TAB_BAR_SPACE + insets.bottom + 40 }}>
        <Animated.View entering={enter(0)} style={styles.header}>
          <KeeperPortrait size={60} cosmetic={cosmetic} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <GText variant="caption" muted>
              {greeting()},
            </GText>
            <GText variant="title" numberOfLines={1}>
              {name}
            </GText>
            <View style={[styles.syncBadge, { borderColor: status === 'guest' ? colors.textFaint : sync.online ? colors.green : colors.goldDeep }]}>
              <GText variant="caption" muted>
                {syncLabel}
              </GText>
            </View>
          </View>
          <GhostCompanion size={60} />
        </Animated.View>

        <Animated.View entering={enter(1)} style={styles.statsRow}>
          <LevelPill level={level.level} />
          <View style={{ width: 10 }} />
          <SoulEnergyBar current={region?.points ?? 0} max={region?.required ?? 200} />
        </Animated.View>
        <Animated.View entering={enter(1)} style={{ marginBottom: 14 }}>
          <ProgressBar ratio={level.ratio} color={colors.purpleSoft} height={6} />
          <GText variant="caption" muted style={{ marginTop: 4 }}>
            {level.current}/{level.needed} XP to level {level.level + 1}
            {display.pendingXp > 0 ? `  ·  +${display.pendingXp} awaiting verification` : ''}
          </GText>
        </Animated.View>

        <Animated.View entering={enter(2)}>
          <PressableScale sound="candle" onPress={() => navigation.navigate('Quests', { segment: 'rituals' })} accessibilityLabel={`Daily rituals, ${rituals.doneCount} of ${rituals.due.length} done`}>
            <Panel title="Daily Rituals" icon={images.candles[0]} right={<GText variant="heading" color={colors.gold}>{rituals.doneCount}/{rituals.due.length}</GText>}>
              <CandleRow lit={litCandles} height={60} />
              <GText variant="caption" muted style={{ textAlign: 'center', marginTop: 8 }}>
                {rituals.due.length === 0 ? 'No rituals yet. Tap to create your first habit.' : 'Each ritual kept lights a candle.'}
              </GText>
            </Panel>
          </PressableScale>
        </Animated.View>

        <Animated.View entering={enter(3)}>
          <Panel
            title="Active Quests"
            icon={images.chestSmall}
            right={
              <PressableScale sound="pageTurn" onPress={() => navigation.navigate('QuestEditor')} accessibilityLabel="Create quest" style={styles.plus}>
                <GText variant="title" color={colors.parchmentInk}>
                  +
                </GText>
              </PressableScale>
            }
          >
            {open.length === 0 ? (
              <GText variant="body" muted style={{ paddingVertical: 8 }}>
                No open quests. Create one or ask the Dark Keeper to plan your day.
              </GText>
            ) : (
              open.slice(0, 3).map(q => (
                <QuestRow key={q.id} quest={q} doneThisPeriod={isDoneThisPeriod(q, history)} onComplete={() => onCompleteQuest(q)} onOpen={() => navigation.navigate('QuestEditor', { questId: q.id })} />
              ))
            )}
            {open.length > 3 ? (
              <PressableScale sound="pageTurn" onPress={() => navigation.navigate('Quests')} style={{ alignItems: 'center', justifyContent: 'center' }}>
                <GText variant="body" color={colors.purpleSoft}>
                  View all {open.length} quests ›
                </GText>
              </PressableScale>
            ) : null}
          </Panel>
        </Animated.View>

        <Animated.View entering={enter(4)}>
          <PressableScale sound="doorCreak" onPress={() => navigation.navigate('World')} accessibilityLabel={`World status. ${area.name}`}>
            <Panel title="World Status" icon={images.decoGate}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Image source={regionArt[area.id]} style={[styles.regionThumb, { borderColor: stateColors[region?.state ?? 'abandoned'] }]} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <GText variant="heading">{area.name}</GText>
                  <View style={{ flexDirection: 'row', marginVertical: 6 }}>
                    <StateChip state={region?.state ?? 'abandoned'} />
                  </View>
                  <GText variant="caption" muted>
                    Graveyard restored: {Math.round(restoration * 100)}%
                  </GText>
                </View>
              </View>
            </Panel>
          </PressableScale>
        </Animated.View>

        <Animated.View entering={enter(5)} style={styles.actions}>
          <PrimaryButton label="Start Focus" icon="▶" sound="candle" onPress={() => navigation.navigate('Focus')} style={{ flex: 1 }} />
          <View style={{ width: 10 }} />
          <SecondaryButton label={'Ask\nDark Keeper'} image={images.ghost} sound="magicTransition" onPress={() => navigation.navigate('DarkKeeper')} style={{ flex: 1 }} />
        </Animated.View>

        <Animated.View entering={enter(6)} style={styles.bubble} accessibilityLiveRegion="polite">
          <Image source={images.keeperAvatar} style={styles.bubbleAvatar} />
          <GText variant="body" color={colors.parchmentInk} style={{ flex: 1, fontWeight: '700' }}>
            {tip}
          </GText>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.night },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  syncBadge: { alignSelf: 'flex-start', borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 1, marginTop: 4 },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  plus: { width: 40, height: 40, minHeight: 40, borderRadius: 12, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  regionThumb: { width: 86, height: 86, borderRadius: 14, borderWidth: 3 },
  actions: { flexDirection: 'row', alignItems: 'stretch', marginBottom: 14 },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.parchment,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: '#C9A86A',
    padding: 10,
  },
  bubbleAvatar: { width: 54, height: 54, marginRight: 10 },
  ground: { position: 'absolute', left: 0, right: 0 },
  tree: { position: 'absolute' },
});
