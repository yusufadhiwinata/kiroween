import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, StyleSheet, View } from 'react-native';
import { sfx, useAudioScene } from '../audio/useAudioScene';
import { Screen } from '../components/Screen';
import { SubHeader } from '../components/SubHeader';
import { Chip, GText, GhostButton, Panel, PrimaryButton, Segmented, Stepper, TextField, ToggleRow } from '../components/ui';
import { WEEKDAYS_SHORT } from '../domain/dates';
import type { ScheduleType } from '../domain/types';
import type { RootScreenProps } from '../navigation/types';
import { syncReminders, ensureNotificationPermission } from '../services/reminders';
import { useKeeper } from '../store/keeperStore';
import { colors } from '../theme';

export function RitualEditorScreen({ navigation, route }: RootScreenProps<'RitualEditor'>) {
  useAudioScene('quests');
  const existing = useKeeper(s => s.rituals.find(r => r.id === route.params?.ritualId));
  const saveRitual = useKeeper(s => s.saveRitual);
  const deleteRitual = useKeeper(s => s.deleteRitual);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [schedule, setSchedule] = useState<ScheduleType>(existing?.schedule_type ?? 'daily');
  const [days, setDays] = useState<number[]>(existing?.schedule_days?.length ? existing.schedule_days : [1, 2, 3, 4, 5]);
  const [target, setTarget] = useState(existing?.weekly_target ?? 3);
  const [reminder, setReminder] = useState(existing?.reminder_enabled ?? false);
  const [initialHour, initialMinute] = (existing?.reminder_time ?? '20:00').split(':').map(Number);
  const [hour, setHour] = useState(initialHour);
  const [minute, setMinute] = useState(initialMinute);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!title.trim()) return setError('Name your ritual.');
    if (schedule === 'custom' && days.length === 0) return setError('Pick at least one day.');
    if (reminder) await ensureNotificationPermission();
    await saveRitual({
      id: existing?.id,
      title,
      description,
      schedule_type: schedule,
      schedule_days: days,
      weekly_target: target,
      reminder_enabled: reminder,
      reminder_time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    });
    syncReminders(useKeeper.getState().rituals);
    sfx('spell');
    navigation.goBack();
  };

  const remove = () => {
    if (!existing) return;
    Alert.alert('Delete ritual?', `"${existing.title}" and its reminder will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteRitual(existing.id);
          syncReminders(useKeeper.getState().rituals);
          navigation.goBack();
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      <Screen art="haunted" dim={0.78} tabs={false}>
        <SubHeader title={existing ? 'Edit ritual' : 'New ritual'} />
        <Panel>
          <TextField label="Ritual name" value={title} onChangeText={t => { setTitle(t); setError(null); }} maxLength={80} placeholder="Read 10 pages" error={error} />
          <TextField label="Notes" value={description} onChangeText={setDescription} maxLength={500} multiline />
        </Panel>
        <Panel title="Schedule">
          <Segmented
            value={schedule}
            onChange={setSchedule}
            options={[
              { value: 'daily', label: 'Daily' },
              { value: 'weekly', label: 'Weekly' },
              { value: 'custom', label: 'Custom' },
            ]}
          />
          {schedule === 'custom' ? (
            <View style={[styles.wrap, { marginTop: 12 }]}>
              {WEEKDAYS_SHORT.map((d, i) => (
                <Chip key={d} label={d} active={days.includes(i)} onPress={() => setDays(days.includes(i) ? days.filter(x => x !== i) : [...days, i])} />
              ))}
            </View>
          ) : null}
          {schedule === 'weekly' ? (
            <View style={{ marginTop: 8 }}>
              <Stepper label="Times per week" value={target} min={1} max={7} onChange={setTarget} />
            </View>
          ) : null}
        </Panel>
        <Panel title="Reminder">
          <ToggleRow label="Remind me" hint="A gentle notification on scheduled days" value={reminder} onChange={setReminder} />
          {reminder ? (
            <>
              <Stepper label="Hour" value={hour} min={0} max={23} onChange={setHour} />
              <Stepper label="Minute" value={minute} min={0} max={55} step={5} onChange={setMinute} />
              <GText variant="caption" muted>
                Reminder at {String(hour).padStart(2, '0')}:{String(minute).padStart(2, '0')}
              </GText>
            </>
          ) : null}
        </Panel>
        <PrimaryButton label={existing ? 'Save ritual' : 'Create ritual'} onPress={save} sound={null} />
        {existing ? <GhostButton label="Delete ritual" color={colors.red} style={{ marginTop: 10 }} onPress={remove} sound="whisper" /> : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
});
