import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { difficultyBadges, images, regionArt } from '../assets/images';
import { QUEST_XP, WORLD_AREAS, categoryById } from '../domain/constants';
import { formatDeadline } from '../domain/dates';
import type { Quest, RegionState, Ritual, WorldProgress } from '../domain/types';
import { colors, difficultyColors, radii, stateColors, usePalette } from '../theme';
import { useMotion } from '../hooks/useMotion';
import { Fog } from './effects';
import { GText, PressableScale, ProgressBar } from './ui';

export function LevelPill({ level }: { level: number }) {
  return (
    <View style={styles.levelPill} accessible accessibilityLabel={`Level ${level}`}>
      <Text style={styles.levelText} maxFontSizeMultiplier={1.3}>
        Lv. {level}
      </Text>
    </View>
  );
}

export function SoulEnergyBar({ current, max, label = 'Soul Energy' }: { current: number; max: number; label?: string }) {
  const ratio = max > 0 ? current / max : 0;
  return (
    <View style={styles.soulWrap} accessible accessibilityLabel={`${label} ${current} of ${max}`}>
      <View style={styles.soulBar}>
        <View style={[styles.soulFill, { width: `${Math.min(100, ratio * 100)}%` }]} />
        <Text style={styles.soulBolt}>⚡</Text>
        <Text style={styles.soulLabel} numberOfLines={1} maxFontSizeMultiplier={1.2}>
          {label}
        </Text>
      </View>
      <Text style={styles.soulValue} maxFontSizeMultiplier={1.2}>
        {current}/{max}
      </Text>
    </View>
  );
}

export function DifficultyBadge({ difficulty, size = 38 }: { difficulty: Quest['difficulty']; size?: number }) {
  return (
    <Image
      source={difficultyBadges[difficulty]}
      style={{ width: size, height: size * 1.2 }}
      resizeMode="contain"
      accessibilityLabel={`${difficulty} difficulty`}
    />
  );
}

export const STATE_LABEL: Record<RegionState, string> = {
  locked: 'Locked',
  abandoned: 'Abandoned',
  awakening: 'Awakening',
  restoration: 'Restoring',
  restored: 'Restored',
};

const STATE_GLYPH: Record<RegionState, string> = {
  locked: '🔒',
  abandoned: '✦',
  awakening: '❖',
  restoration: '✧',
  restored: '✔',
};

export function StateChip({ state }: { state: RegionState }) {
  return (
    <View style={[styles.stateChip, { backgroundColor: stateColors[state] }]}>
      <Text style={styles.stateChipText} maxFontSizeMultiplier={1.2}>
        {STATE_GLYPH[state]} {STATE_LABEL[state]}
      </Text>
    </View>
  );
}

/** Darkness + fog overlay that lifts as a region is restored. */
export const STATE_SHADE: Record<RegionState, number> = {
  locked: 0.78,
  abandoned: 0.55,
  awakening: 0.35,
  restoration: 0.15,
  restored: 0,
};

export function RegionCard({ progress, onPress, width }: { progress: WorldProgress; onPress: () => void; width: number }) {
  const area = WORLD_AREAS.find(a => a.id === progress.area_id)!;
  const ratio = progress.required ? progress.points / progress.required : 0;
  const locked = progress.state === 'locked';
  return (
    <PressableScale
      sound={locked ? 'whisper' : 'doorCreak'}
      onPress={onPress}
      accessibilityLabel={`${area.name}, ${STATE_LABEL[progress.state]}, ${Math.round(ratio * 100)} percent restored`}
      style={[styles.regionCard, { width, borderColor: stateColors[progress.state] }]}
    >
      <View style={{ height: width * 0.92, overflow: 'hidden', borderTopLeftRadius: radii.lg - 3, borderTopRightRadius: radii.lg - 3 }}>
        <Image source={regionArt[area.id]} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#05040F', opacity: STATE_SHADE[progress.state] }]} />
        {progress.state !== 'restored' ? <Fog bottom={0} height={width * 0.5} opacity={locked ? 0.5 : 0.3} duration={30000} /> : null}
        {locked ? <Text style={styles.lockGlyph}>🔒</Text> : null}
      </View>
      <View style={{ padding: 10, alignItems: 'center' }}>
        <GText variant="heading" style={{ textAlign: 'center' }} numberOfLines={2}>
          {area.name}
        </GText>
        <View style={{ marginVertical: 8 }}>
          <StateChip state={progress.state} />
        </View>
        {locked ? (
          <GText variant="caption" muted>
            Req. Lv. {area.unlockLevel}
          </GText>
        ) : (
          <View style={{ alignSelf: 'stretch' }}>
            <ProgressBar ratio={ratio} color={stateColors[progress.state]} height={8} />
            <GText variant="caption" style={{ textAlign: 'center', marginTop: 4 }}>
              {Math.round(ratio * 100)}%
            </GText>
          </View>
        )}
      </View>
    </PressableScale>
  );
}

export function Checkbox({ checked, onPress, label, disabled }: { checked: boolean; onPress: () => void; label: string; disabled?: boolean }) {
  const { reduceMotion } = useMotion();
  const s = useSharedValue(checked ? 1 : 0);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }], opacity: s.value }));
  return (
    <PressableScale
      sound={null}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={label}
      hitSlop={8}
      onPress={() => {
        if (!checked) s.value = reduceMotion ? 1 : withSequence(withSpring(1.3, { damping: 6 }), withTiming(1, { duration: 120 }));
        onPress();
      }}
      style={styles.checkHit}
    >
      <View style={[styles.checkBox, checked && { borderColor: colors.gold, backgroundColor: 'rgba(251,191,36,0.15)' }]}>
        <Animated.Text style={[styles.checkMark, style]}>✓</Animated.Text>
      </View>
    </PressableScale>
  );
}

export function QuestRow({
  quest,
  onComplete,
  onOpen,
  doneThisPeriod,
}: {
  quest: Quest;
  onComplete: () => void;
  onOpen: () => void;
  doneThisPeriod: boolean;
}) {
  const p = usePalette();
  const [checking, setChecking] = useState(false);
  const cat = categoryById(quest.category_id);
  const done = quest.status === 'completed' || doneThisPeriod;
  const overdue = !!quest.deadline && new Date(quest.deadline).getTime() < Date.now() && !done;
  const sub = [cat?.name, quest.recurrence !== 'none' ? (quest.recurrence === 'daily' ? 'Daily' : 'Weekly') : null, formatDeadline(quest.deadline)]
    .filter(Boolean)
    .join(' · ');
  return (
    <View style={[styles.questRow, { borderColor: p.panelBorder }]}>
      <Checkbox
        checked={done || checking}
        disabled={done}
        label={`Complete ${quest.title}`}
        onPress={() => {
          setChecking(true);
          onComplete();
        }}
      />
      <PressableScale sound="pageTurn" onPress={onOpen} style={{ flex: 1, justifyContent: 'center' }} accessibilityLabel={`Edit quest ${quest.title}`}>
        <GText variant="body" style={[{ fontWeight: '800' }, done && { textDecorationLine: 'line-through', opacity: 0.6 }]} numberOfLines={2}>
          {quest.source === 'ai' ? '✦ ' : ''}
          {quest.title}
        </GText>
        <GText variant="caption" color={overdue ? colors.red : p.textMuted} numberOfLines={1}>
          {sub}
        </GText>
      </PressableScale>
      <View style={{ alignItems: 'flex-end', marginLeft: 6 }}>
        <Text style={[styles.xp, { color: difficultyColors[quest.difficulty] }]} maxFontSizeMultiplier={1.2}>
          +{QUEST_XP[quest.difficulty]} XP
        </Text>
        <DifficultyBadge difficulty={quest.difficulty} size={26} />
      </View>
    </View>
  );
}

export function RitualRow({
  ritual,
  doneToday,
  due,
  streak,
  onCheck,
  onOpen,
}: {
  ritual: Ritual;
  doneToday: boolean;
  due: boolean;
  streak: number;
  onCheck: () => void;
  onOpen: () => void;
}) {
  const p = usePalette();
  const schedule =
    ritual.schedule_type === 'daily'
      ? 'Every day'
      : ritual.schedule_type === 'weekly'
        ? `${ritual.weekly_target}× per week`
        : ritual.schedule_days.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ');
  return (
    <View style={[styles.questRow, { borderColor: p.panelBorder }]}>
      <Image source={images.candles[doneToday ? 0 : 5]} style={{ width: 26, height: 56, opacity: doneToday ? 1 : 0.5, marginRight: 10 }} resizeMode="contain" />
      <PressableScale sound="pageTurn" onPress={onOpen} style={{ flex: 1, justifyContent: 'center' }} accessibilityLabel={`Edit ritual ${ritual.title}`}>
        <GText variant="body" style={{ fontWeight: '800' }} numberOfLines={2}>
          {ritual.title}
        </GText>
        <GText variant="caption" muted numberOfLines={1}>
          {schedule}
          {ritual.reminder_enabled && ritual.reminder_time ? ` · ⏰ ${ritual.reminder_time}` : ''}
        </GText>
        <GText variant="caption" color={colors.gold}>
          🔥 {streak} {ritual.schedule_type === 'weekly' ? 'week' : 'day'} streak
        </GText>
      </PressableScale>
      <PressableScale
        sound={null}
        disabled={doneToday || !due}
        onPress={onCheck}
        accessibilityLabel={doneToday ? `${ritual.title} done today` : `Check in ${ritual.title}`}
        style={[styles.checkIn, doneToday && { backgroundColor: 'rgba(34,197,94,0.2)', borderColor: colors.green }]}
      >
        <Text style={[styles.checkInText, doneToday && { color: colors.green }]} maxFontSizeMultiplier={1.2}>
          {doneToday ? 'Done' : due ? '+15 XP' : 'Rest'}
        </Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  levelPill: {
    backgroundColor: colors.navy,
    borderColor: colors.panelBorder,
    borderWidth: 3,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  levelText: { color: colors.gold, fontWeight: '900', fontSize: 18 },
  soulWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.navy,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: colors.panelBorder,
    overflow: 'hidden',
    flex: 1,
  },
  soulBar: { flex: 1, height: 34, justifyContent: 'center', backgroundColor: '#3A2E10', overflow: 'hidden' },
  soulFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.gold },
  soulBolt: { position: 'absolute', left: 8, fontSize: 16 },
  soulLabel: { marginLeft: 30, color: '#1F1300', fontWeight: '900', fontSize: 13 },
  soulValue: { color: colors.text, fontWeight: '900', paddingHorizontal: 10, fontSize: 14 },
  stateChip: { borderRadius: radii.pill, paddingHorizontal: 12, paddingVertical: 5 },
  stateChipText: { color: '#fff', fontWeight: '900', fontSize: 12.5 },
  regionCard: {
    backgroundColor: colors.panelSolid,
    borderRadius: radii.lg,
    borderWidth: 3,
    marginBottom: 14,
    overflow: 'hidden',
  },
  lockGlyph: { position: 'absolute', alignSelf: 'center', top: '38%', fontSize: 34 },
  checkHit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  checkBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { color: colors.gold, fontSize: 20, fontWeight: '900', marginTop: -2 },
  questRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  xp: { fontWeight: '900', fontSize: 14, marginBottom: 2 },
  checkIn: {
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.gold,
    paddingHorizontal: 12,
    justifyContent: 'center',
    minWidth: 76,
    alignItems: 'center',
  },
  checkInText: { color: colors.gold, fontWeight: '900', fontSize: 13 },
});
