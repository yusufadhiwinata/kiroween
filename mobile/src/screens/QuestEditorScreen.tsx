import React, { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, StyleSheet, View } from 'react-native';
import { sfx, useAudioScene } from '../audio/useAudioScene';
import { DifficultyBadge } from '../components/game';
import { Screen } from '../components/Screen';
import { SubHeader } from '../components/SubHeader';
import { Chip, GText, GhostButton, Panel, PressableScale, PrimaryButton, RoundAction, Segmented, TextField } from '../components/ui';
import { CATEGORIES, DIFFICULTIES, PRIORITIES, PRIORITY_LABEL, QUEST_XP } from '../domain/constants';
import { addDays, endOfDay, formatDeadline } from '../domain/dates';
import type { Difficulty, Priority, Recurrence } from '../domain/types';
import type { RootScreenProps } from '../navigation/types';
import { useKeeper } from '../store/keeperStore';
import { colors, difficultyColors } from '../theme';

const QUICK = [
  { label: 'None', days: null },
  { label: 'Today', days: 0 },
  { label: 'Tomorrow', days: 1 },
  { label: '3 days', days: 3 },
  { label: 'Next week', days: 7 },
] as const;

const TIMES = [
  [9, 0],
  [12, 0],
  [17, 0],
  [21, 0],
  [23, 59],
] as const;

export function QuestEditorScreen({ navigation, route }: RootScreenProps<'QuestEditor'>) {
  useAudioScene('quests');
  const existing = useKeeper(s => s.quests.find(q => q.id === route.params?.questId));
  const saveQuest = useKeeper(s => s.saveQuest);
  const deleteQuest = useKeeper(s => s.deleteQuest);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [difficulty, setDifficulty] = useState<Difficulty>(existing?.difficulty ?? 'easy');
  const [priority, setPriority] = useState<Priority>(existing?.priority ?? 'medium');
  const [categoryId, setCategoryId] = useState<string | null>(existing?.category_id ?? null);
  const [recurrence, setRecurrence] = useState<Recurrence>(existing?.recurrence ?? 'none');
  const [deadline, setDeadline] = useState<Date | null>(existing?.deadline ? new Date(existing.deadline) : null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const completed = existing?.status === 'completed';
  const deadlineLabel = useMemo(() => (deadline ? formatDeadline(deadline.toISOString()) : 'No deadline'), [deadline]);

  const save = async () => {
    if (!title.trim()) return setError('Give your quest a name.');
    setBusy(true);
    try {
      await saveQuest({
        id: existing?.id,
        title,
        description,
        difficulty,
        priority,
        category_id: categoryId,
        recurrence,
        deadline: deadline ? deadline.toISOString() : null,
      });
      sfx('spell');
      navigation.goBack();
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    if (!existing) return;
    Alert.alert('Delete quest?', `"${existing.title}" will vanish into the fog.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteQuest(existing.id);
          sfx('whisper');
          navigation.goBack();
        },
      },
    ]);
  };

  const shiftDay = (delta: number) => {
    const base = deadline ?? endOfDay(new Date());
    setDeadline(addDays(base, delta));
  };

  const setTime = (h: number, m: number) => {
    const base = new Date(deadline ?? new Date());
    base.setHours(h, m, 0, 0);
    setDeadline(base);
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      <Screen art="haunted" dim={0.78} tabs={false}>
        <SubHeader title={existing ? 'Edit quest' : 'New quest'} subtitle={completed ? 'Completed — rewards were already granted' : undefined} />
        <Panel>
          <TextField label="Quest name" value={title} onChangeText={t => { setTitle(t); setError(null); }} maxLength={120} placeholder="Collect 10 soul crystals" error={error} />
          <TextField label="Notes" value={description} onChangeText={setDescription} maxLength={1000} multiline placeholder="Where, how, why…" />
        </Panel>

        <Panel title="Difficulty">
          <View style={styles.badges}>
            {DIFFICULTIES.map(d => (
              <PressableScale
                key={d}
                sound="pageTurn"
                onPress={() => setDifficulty(d)}
                accessibilityState={{ selected: difficulty === d }}
                accessibilityLabel={`${d}, ${QUEST_XP[d]} XP`}
                style={[styles.badge, difficulty === d && { borderColor: difficultyColors[d], backgroundColor: 'rgba(255,255,255,0.06)' }]}
              >
                <DifficultyBadge difficulty={d} size={48} />
                <GText variant="caption" color={difficultyColors[d]} style={{ marginTop: 4 }}>
                  +{QUEST_XP[d]} XP
                </GText>
              </PressableScale>
            ))}
          </View>
        </Panel>

        <Panel title="Priority">
          <Segmented value={priority} onChange={setPriority} options={PRIORITIES.map(p => ({ value: p, label: PRIORITY_LABEL[p] }))} />
        </Panel>

        <Panel title="Category">
          <View style={styles.wrap}>
            <Chip label="None" active={!categoryId} onPress={() => setCategoryId(null)} color={colors.purpleSoft} />
            {CATEGORIES.map(c => (
              <Chip key={c.id} label={c.name} active={categoryId === c.id} color={c.color} onPress={() => setCategoryId(c.id)} />
            ))}
          </View>
        </Panel>

        <Panel title="Deadline" right={<GText variant="body" color={colors.gold}>{deadlineLabel}</GText>}>
          <View style={styles.wrap}>
            {QUICK.map(q => (
              <Chip
                key={q.label}
                label={q.label}
                active={q.days === null ? deadline === null : false}
                onPress={() => setDeadline(q.days === null ? null : endOfDay(addDays(new Date(), q.days)))}
              />
            ))}
          </View>
          {deadline ? (
            <>
              <View style={styles.dayRow}>
                <RoundAction glyph="−" label="One day earlier" onPress={() => shiftDay(-1)} />
                <GText variant="heading" style={{ flex: 1, textAlign: 'center' }}>
                  {deadline.toDateString()}
                </GText>
                <RoundAction glyph="+" label="One day later" onPress={() => shiftDay(1)} />
              </View>
              <View style={styles.wrap}>
                {TIMES.map(([h, m]) => (
                  <Chip key={`${h}:${m}`} label={`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`} active={deadline.getHours() === h && deadline.getMinutes() === m} onPress={() => setTime(h, m)} />
                ))}
              </View>
            </>
          ) : null}
        </Panel>

        <Panel title="Repeat">
          <Segmented
            value={recurrence}
            onChange={setRecurrence}
            options={[
              { value: 'none', label: 'Once' },
              { value: 'daily', label: 'Daily' },
              { value: 'weekly', label: 'Weekly' },
            ]}
          />
          <GText variant="caption" muted style={{ marginTop: 8 }}>
            Recurring quests reward XP once per day or week.
          </GText>
        </Panel>

        <PrimaryButton label={busy ? 'Inscribing…' : existing ? 'Save quest' : 'Create quest'} disabled={busy} onPress={save} sound={null} />
        {existing && !completed ? (
          <GhostButton label="Focus on this quest" color={colors.gold} style={{ marginTop: 10 }} onPress={() => navigation.navigate('Focus', { questId: existing.id })} />
        ) : null}
        {existing ? <GhostButton label="Delete quest" color={colors.red} style={{ marginTop: 10 }} onPress={remove} sound="whisper" /> : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  badges: { flexDirection: 'row', justifyContent: 'space-between' },
  badge: { alignItems: 'center', padding: 6, borderRadius: 14, borderWidth: 2, borderColor: 'transparent', flex: 1, marginHorizontal: 2 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  dayRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 8 },
});
