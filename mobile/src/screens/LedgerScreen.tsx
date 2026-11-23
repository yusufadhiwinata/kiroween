import React, { useMemo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { images, namedIcons } from '../assets/images';
import { useAudioScene } from '../audio/useAudioScene';
import { Screen } from '../components/Screen';
import { GText, Panel, PressableScale } from '../components/ui';
import { ACHIEVEMENTS } from '../domain/constants';
import { WEEKDAYS_SHORT, addDays, dayKey, formatShortDate, startOfWeek } from '../domain/dates';
import { useMotion } from '../hooks/useMotion';
import { useProgress } from '../hooks/useKeeperData';
import type { RootStackParamList, TabParamList } from '../navigation/types';
import { useKeeper } from '../store/keeperStore';
import { colors } from '../theme';

type Props = CompositeScreenProps<BottomTabScreenProps<TabParamList, 'Ledger'>, NativeStackScreenProps<RootStackParamList>>;

function Bar({ ratio, label, value, highlight, index }: { ratio: number; label: string; value: number; highlight?: boolean; index: number }) {
  const { reduceMotion } = useMotion();
  const h = useSharedValue(reduceMotion ? ratio : 0);
  React.useEffect(() => {
    h.value = reduceMotion ? ratio : withDelay(index * 60, withTiming(ratio, { duration: 600 }));
  }, [ratio, reduceMotion, index, h]);
  const style = useAnimatedStyle(() => ({ height: `${Math.max(4, h.value * 100)}%` }));
  return (
    <View style={styles.barCol} accessible accessibilityLabel={`${label}: ${value} XP`}>
      <GText variant="caption" muted style={{ fontSize: 10.5 }}>
        {value}
      </GText>
      <View style={styles.barTrack}>
        <Animated.View style={[styles.barFill, { backgroundColor: highlight ? colors.gold : colors.purpleSoft }, style]} />
      </View>
      <GText variant="caption" color={highlight ? colors.gold : colors.textMuted}>
        {label}
      </GText>
    </View>
  );
}

function Stat({ label, value, image }: { label: string; value: string; image: number }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <Image source={image} style={{ width: 34, height: 34 }} resizeMode="contain" />
      <GText variant="title" style={{ marginTop: 4 }}>
        {value}
      </GText>
      <GText variant="caption" muted style={{ textAlign: 'center' }}>
        {label}
      </GText>
    </View>
  );
}

const SOURCE_LABEL = { quest: 'Quest', ritual: 'Ritual', focus: 'Focus', achievement: 'Achievement', bonus: 'Bonus' } as const;

export function LedgerScreen({ navigation }: Props) {
  useAudioScene('ledger');
  const xp = useKeeper(s => s.xp);
  const history = useKeeper(s => s.history);
  const focus = useKeeper(s => s.focus);
  const completions = useKeeper(s => s.completions);
  const { display } = useProgress();

  const data = useMemo(() => {
    const today = new Date();
    const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
    const xpByDay = new Map<string, number>();
    xp.forEach(e => {
      const k = dayKey(new Date(e.created_at));
      xpByDay.set(k, (xpByDay.get(k) ?? 0) + e.amount);
    });
    const week = days.map(d => ({ key: dayKey(d), label: WEEKDAYS_SHORT[d.getDay()].slice(0, 2), value: xpByDay.get(dayKey(d)) ?? 0 }));
    const weekMax = Math.max(10, ...week.map(w => w.value));
    const weekStart = startOfWeek(today);
    const weeks = Array.from({ length: 4 }, (_, i) => {
      const start = addDays(weekStart, -7 * (3 - i)).getTime();
      const end = start + 7 * 86_400_000;
      return { label: i === 3 ? 'This wk' : `-${3 - i} wk`, value: xp.filter(e => { const t = new Date(e.created_at).getTime(); return t >= start && t < end; }).reduce((s, e) => s + e.amount, 0) };
    });
    const weeksMax = Math.max(10, ...weeks.map(w => w.value));
    const todayKey = dayKey(today);
    const sevenAgo = addDays(today, -7).getTime();
    const focusWeek = focus.filter(f => (f.kind === 'pomodoro' || f.kind === 'custom') && new Date(f.started_at).getTime() >= sevenAgo).reduce((s, f) => s + f.actual_minutes, 0);
    const questsToday = history.filter(h => dayKey(new Date(h.completed_at)) === todayKey).length;
    const questsWeek = history.filter(h => new Date(h.completed_at).getTime() >= sevenAgo).length;
    const ritualsWeek = completions.filter(c => new Date(c.completed_at).getTime() >= sevenAgo).length;
    const last = weeks[2].value;
    const trend = last === 0 ? (weeks[3].value > 0 ? 100 : 0) : Math.round(((weeks[3].value - last) / last) * 100);
    return { week, weekMax, weeks, weeksMax, todayXp: xpByDay.get(todayKey) ?? 0, weekXp: week.reduce((s, w) => s + w.value, 0), focusWeek, questsToday, questsWeek, ritualsWeek, trend };
  }, [xp, history, focus, completions]);

  const unlocked = display.achievements.length;

  return (
    <Screen art="haunted" dim={0.72} title="Soul Ledger" subtitle="Every soul you awakened, recorded.">
      <View style={styles.stats}>
        <Stat label="XP today" value={String(data.todayXp)} image={images.coin} />
        <Stat label="XP this week" value={String(data.weekXp)} image={images.gem} />
        <Stat label="Day streak" value={`${display.stats.current_streak}`} image={images.candles[0]} />
      </View>
      <View style={styles.stats}>
        <Stat label="Quests today" value={String(data.questsToday)} image={images.chestSmall} />
        <Stat label="Quests (7 days)" value={String(data.questsWeek)} image={images.potion} />
        <Stat label="Focus (7 days)" value={`${data.focusWeek}m`} image={images.iconMusic} />
      </View>

      <Panel title="Daily productivity" icon={images.bannerGhost}>
        <View style={styles.chart}>
          {data.week.map((w, i) => (
            <Bar key={w.key} index={i} ratio={w.value / data.weekMax} label={w.label} value={w.value} highlight={i === 6} />
          ))}
        </View>
      </Panel>

      <Panel title="Weekly trend" icon={images.decoCrystals} right={<GText variant="heading" color={data.trend >= 0 ? colors.green : colors.red}>{data.trend >= 0 ? '▲' : '▼'} {Math.abs(data.trend)}%</GText>}>
        <View style={styles.chart}>
          {data.weeks.map((w, i) => (
            <Bar key={w.label} index={i} ratio={w.value / data.weeksMax} label={w.label} value={w.value} highlight={i === 3} />
          ))}
        </View>
        <GText variant="caption" muted style={{ marginTop: 6 }}>
          Longest streak {display.stats.longest_streak} days · {display.stats.quests_completed} quests all-time · {data.ritualsWeek} ritual check-ins this week · {display.stats.focus_minutes} focus minutes total
        </GText>
      </Panel>

      <PressableScale sound="achievement" onPress={() => navigation.navigate('Achievements')} accessibilityLabel={`Achievements, ${unlocked} of ${ACHIEVEMENTS.length} unlocked`}>
        <Panel title="Achievements" icon={images.chestBig} right={<GText variant="heading" color={colors.gold}>{unlocked}/{ACHIEVEMENTS.length} ›</GText>}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {ACHIEVEMENTS.map(a => {
              const has = display.achievements.some(u => u.id === a.id);
              return <Image key={a.id} source={namedIcons[a.icon]} style={{ width: 44, height: 44, opacity: has ? 1 : 0.22 }} resizeMode="contain" />;
            })}
          </View>
        </Panel>
      </PressableScale>

      <Panel title="XP history" icon={images.coin}>
        {xp.length === 0 ? (
          <GText variant="body" muted>
            Complete a quest, ritual or focus session to begin your ledger.
          </GText>
        ) : (
          xp.slice(0, 20).map(e => (
            <View key={e.id} style={styles.entry}>
              <View style={{ flex: 1 }}>
                <GText variant="body" style={{ fontWeight: '700' }} numberOfLines={1}>
                  {e.note ?? SOURCE_LABEL[e.source_type]}
                </GText>
                <GText variant="caption" muted>
                  {SOURCE_LABEL[e.source_type]} · {formatShortDate(e.created_at)}
                  {e.sync_status === 'pending' ? ' · awaiting verification' : ''}
                </GText>
              </View>
              <GText variant="heading" color={e.sync_status === 'pending' ? colors.textMuted : colors.gold}>
                +{e.amount}
              </GText>
            </View>
          ))
        )}
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  stat: { flex: 1, alignItems: 'center', backgroundColor: colors.panel, borderRadius: 16, borderWidth: 2, borderColor: colors.panelBorder, paddingVertical: 10, paddingHorizontal: 4 },
  chart: { flexDirection: 'row', height: 150, alignItems: 'flex-end', justifyContent: 'space-between' },
  barCol: { flex: 1, alignItems: 'center', height: '100%' },
  barTrack: { flex: 1, width: 18, justifyContent: 'flex-end', marginVertical: 4 },
  barFill: { width: '100%', borderRadius: 6 },
  entry: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.panelBorder },
});
