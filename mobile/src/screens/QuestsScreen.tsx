import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { images } from '../assets/images';
import { useAudioScene } from '../audio/useAudioScene';
import { CandleRow } from '../components/characters';
import { QuestRow, RitualRow } from '../components/game';
import { Screen } from '../components/Screen';
import { Chip, EmptyState, GText, Panel, PrimaryButton, RoundAction, Segmented, TextField } from '../components/ui';
import { CATEGORIES } from '../domain/constants';
import { addDays, endOfDay } from '../domain/dates';
import { useMotion } from '../hooks/useMotion';
import { isDoneThisPeriod, sortQuests, useCompletionActions, useTodayRituals } from '../hooks/useKeeperData';
import type { RootStackParamList, TabParamList } from '../navigation/types';
import { useKeeper } from '../store/keeperStore';
import { runSync } from '../services/sync';
import { colors } from '../theme';

type Props = CompositeScreenProps<BottomTabScreenProps<TabParamList, 'Quests'>, NativeStackScreenProps<RootStackParamList>>;
type Filter = 'all' | 'today' | 'weekly' | 'boss' | 'done';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'today', label: 'Today' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'boss', label: 'Boss' },
  { value: 'done', label: 'Done' },
];

export function QuestsScreen({ navigation, route }: Props) {
  useAudioScene('quests');
  const { reduceMotion } = useMotion();
  const [segment, setSegment] = useState<'quests' | 'rituals'>(route.params?.segment ?? 'quests');
  const [filter, setFilter] = useState<Filter>('all');
  const [category, setCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const quests = useKeeper(s => s.quests);
  const history = useKeeper(s => s.history);
  const rituals = useTodayRituals();
  const { onCompleteQuest, onCompleteRitual } = useCompletionActions();

  useEffect(() => {
    if (route.params?.segment) setSegment(route.params.segment);
  }, [route.params?.segment]);

  const visible = useMemo(() => {
    const now = new Date();
    const todayEnd = endOfDay(now).getTime();
    const weekEnd = endOfDay(addDays(now, 7)).getTime();
    const term = search.trim().toLowerCase();
    return sortQuests(
      quests.filter(q => {
        if (q.status === 'archived') return false;
        const done = isDoneThisPeriod(q, history);
        if (filter === 'done') {
          if (!done) return false;
        } else if (done && q.recurrence === 'none') return false;
        const due = q.deadline ? new Date(q.deadline).getTime() : null;
        if (filter === 'today' && !(q.recurrence === 'daily' || (due !== null && due <= todayEnd))) return false;
        if (filter === 'weekly' && !(q.recurrence === 'weekly' || (due !== null && due <= weekEnd))) return false;
        if (filter === 'boss' && q.difficulty !== 'boss') return false;
        if (category && q.category_id !== category) return false;
        if (term && !`${q.title} ${q.description}`.toLowerCase().includes(term)) return false;
        return true;
      }),
    );
  }, [quests, history, filter, category, search]);

  const refresh = async () => {
    setRefreshing(true);
    await runSync();
    setRefreshing(false);
  };

  return (
    <Screen
      art="haunted"
      dim={0.7}
      title={segment === 'quests' ? 'Quests' : 'Rituals'}
      subtitle={segment === 'quests' ? 'Every task awakens a forgotten soul.' : 'Habits keep the lanterns burning.'}
      onRefresh={refresh}
      refreshing={refreshing}
      right={<RoundAction glyph="+" tone="gold" label={segment === 'quests' ? 'Create quest' : 'Create ritual'} onPress={() => navigation.navigate(segment === 'quests' ? 'QuestEditor' : 'RitualEditor')} />}
    >
      <View style={{ marginBottom: 14 }}>
        <Segmented
          value={segment}
          onChange={setSegment}
          options={[
            { value: 'quests', label: 'Quests' },
            { value: 'rituals', label: 'Rituals' },
          ]}
        />
      </View>

      {segment === 'quests' ? (
        <>
          <TextField label="Search quests" value={search} onChangeText={setSearch} placeholder="Search by title or note" returnKeyType="search" />
          <View style={styles.chips}>
            {FILTERS.map(f => (
              <Chip key={f.value} label={f.label} active={filter === f.value} onPress={() => setFilter(f.value)} />
            ))}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 6 }}>
            <Chip label="All categories" active={!category} onPress={() => setCategory(null)} color={colors.purpleSoft} />
            {CATEGORIES.map(c => (
              <Chip key={c.id} label={c.name} active={category === c.id} color={c.color} onPress={() => setCategory(category === c.id ? null : c.id)} />
            ))}
          </ScrollView>
          <Panel title={`${visible.length} quest${visible.length === 1 ? '' : 's'}`} icon={images.chestSmall}>
            {visible.length === 0 ? (
              <EmptyState
                image={images.pumpkin}
                title={quests.length === 0 ? 'No quests yet' : 'Nothing matches'}
                message={quests.length === 0 ? 'Create your first quest. Easy 10 XP, Medium 25, Hard 50, Boss 100.' : 'Try another filter or search.'}
                action={quests.length === 0 ? <PrimaryButton label="Create quest" onPress={() => navigation.navigate('QuestEditor')} /> : undefined}
              />
            ) : (
              visible.map((q, i) => (
                <Animated.View key={q.id} entering={reduceMotion ? undefined : FadeInDown.delay(Math.min(i, 8) * 40)} layout={reduceMotion ? undefined : LinearTransition}>
                  <QuestRow quest={q} doneThisPeriod={isDoneThisPeriod(q, history)} onComplete={() => onCompleteQuest(q)} onOpen={() => navigation.navigate('QuestEditor', { questId: q.id })} />
                </Animated.View>
              ))
            )}
          </Panel>
        </>
      ) : (
        <>
          <Panel title="Today's candles" icon={images.candles[0]} right={<GText variant="heading" color={colors.gold}>{rituals.doneCount}/{rituals.due.length}</GText>}>
            <CandleRow lit={rituals.due.length ? Math.round((rituals.doneCount / rituals.due.length) * 6) : 0} height={64} />
          </Panel>
          <Panel title="Rituals" icon={images.bannerGhost}>
            {rituals.all.length === 0 ? (
              <EmptyState
                image={images.cat}
                title="No rituals yet"
                message="Rituals are daily, weekly or custom habits. Each check-in earns 15 XP and builds a streak."
                action={<PrimaryButton label="Create ritual" onPress={() => navigation.navigate('RitualEditor')} />}
              />
            ) : (
              rituals.all.map(r => (
                <RitualRow
                  key={r.id}
                  ritual={r}
                  doneToday={rituals.doneIds.has(r.id)}
                  due={rituals.due.some(d => d.id === r.id)}
                  streak={rituals.streaks.get(r.id) ?? 0}
                  onCheck={() => onCompleteRitual(r)}
                  onOpen={() => navigation.navigate('RitualEditor', { ritualId: r.id })}
                />
              ))
            )}
          </Panel>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 },
});
