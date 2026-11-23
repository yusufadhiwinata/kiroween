import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { sfx, useAudioScene } from '../audio/useAudioScene';
import { CandleRow } from '../components/characters';
import { Glow } from '../components/effects';
import { Screen } from '../components/Screen';
import { SubHeader } from '../components/SubHeader';
import { Chip, GText, GhostButton, Panel, PrimaryButton, Stepper } from '../components/ui';
import { dayKey, formatShortDate, addDays } from '../domain/dates';
import type { FocusKind } from '../domain/types';
import { useOpenQuests } from '../hooks/useKeeperData';
import type { RootScreenProps } from '../navigation/types';
import { readJson, writeJson, kv } from '../storage/mmkv';
import { useKeeper } from '../store/keeperStore';
import { useSettings } from '../store/settingsStore';
import { toast } from '../store/uiStore';
import { colors } from '../theme';

type Phase = 'idle' | 'running' | 'paused';

interface TimerState {
  phase: Phase;
  kind: FocusKind;
  planned: number;
  startedAt: number | null; // wall-clock start of the session
  accumulatedMs: number; // focused time before the current run segment
  segmentStart: number | null;
  questId: string | null;
  pomodorosDone: number;
}

const TIMER_KEY = 'focus.timer.v1';

const KIND_LABEL: Record<FocusKind, string> = {
  pomodoro: 'Pomodoro',
  short_break: 'Short break',
  long_break: 'Long break',
  custom: 'Custom',
};

const elapsedOf = (t: TimerState, now: number) => t.accumulatedMs + (t.phase === 'running' && t.segmentStart ? now - t.segmentStart : 0);
const fmt = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

export function FocusScreen({ route }: RootScreenProps<'Focus'>) {
  useAudioScene('focus');
  const settings = useSettings();
  const recordFocus = useKeeper(s => s.recordFocus);
  const focus = useKeeper(s => s.focus);
  const openQuests = useOpenQuests();
  const durations = useMemo<Record<FocusKind, number>>(
    () => ({ pomodoro: settings.focusMinutes, short_break: settings.shortBreakMinutes, long_break: settings.longBreakMinutes, custom: 45 }),
    [settings.focusMinutes, settings.shortBreakMinutes, settings.longBreakMinutes],
  );
  const [timer, setTimer] = useState<TimerState>(() =>
    readJson<TimerState>(TIMER_KEY, {
      phase: 'idle',
      kind: 'pomodoro',
      planned: settings.focusMinutes,
      startedAt: null,
      accumulatedMs: 0,
      segmentStart: null,
      questId: route.params?.questId ?? null,
      pomodorosDone: 0,
    }),
  );
  const [now, setNow] = useState(Date.now());
  const lastMinute = useRef(-1);
  const lastCandles = useRef(-1);
  const finishing = useRef(false);

  const persist = useCallback((t: TimerState) => {
    setTimer(t);
    if (t.phase === 'idle') kv.remove(TIMER_KEY);
    else writeJson(TIMER_KEY, t);
  }, []);

  useEffect(() => {
    if (route.params?.questId && timer.phase === 'idle') setTimer(t => ({ ...t, questId: route.params?.questId ?? null }));
  }, [route.params?.questId, timer.phase]);

  const plannedMs = timer.planned * 60_000;
  const elapsed = elapsedOf(timer, now);
  const remaining = Math.max(0, plannedMs - elapsed);
  const candles = timer.phase === 'idle' ? 6 : Math.ceil((remaining / plannedMs) * 6);

  const finish = useCallback(
    async (completedFully: boolean, t: TimerState) => {
      if (finishing.current || !t.startedAt) return;
      finishing.current = true;
      const end = Date.now();
      const actual = completedFully ? t.planned : Math.floor(elapsedOf(t, end) / 60_000);
      const isFocus = t.kind === 'pomodoro' || t.kind === 'custom';
      persist({ ...t, phase: 'idle', startedAt: null, accumulatedMs: 0, segmentStart: null, pomodorosDone: t.pomodorosDone + (t.kind === 'pomodoro' && completedFully ? 1 : 0) });
      if (actual >= 1) {
        const res = await recordFocus({ kind: t.kind, planned: t.planned, actual, startedAt: new Date(t.startedAt), endedAt: new Date(end), questId: isFocus ? t.questId : null });
        sfx('reward');
        toast({
          tone: 'keeper',
          title: isFocus ? (completedFully ? 'The candles burned true' : 'Focus recorded') : 'Rest complete',
          message: isFocus ? `${actual} minutes of focus${res.xp ? '' : actual < 5 ? ' (5+ minutes earn XP)' : ' (daily focus reward cap reached)'}.` : 'Ready for the next candle?',
          xp: res.xp || undefined,
        });
      }
      // Pomodoro cycle: focus -> short break (long break every 4th) -> focus.
      if (completedFully) {
        const nextKind: FocusKind = isFocus ? ((t.pomodorosDone + 1) % 4 === 0 ? 'long_break' : 'short_break') : 'pomodoro';
        setTimer(prev => ({ ...prev, kind: nextKind, planned: durations[nextKind] }));
      }
      finishing.current = false;
    },
    [persist, recordFocus, durations],
  );

  useEffect(() => {
    if (timer.phase !== 'running') return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [timer.phase]);

  useEffect(() => {
    if (timer.phase !== 'running') return;
    if (remaining <= 0) {
      void finish(true, timer);
      return;
    }
    const minute = Math.floor(elapsed / 60_000);
    if (lastMinute.current !== -1 && minute !== lastMinute.current) sfx('tick');
    lastMinute.current = minute;
    if (lastCandles.current !== -1 && candles < lastCandles.current) sfx('candle');
    lastCandles.current = candles;
  }, [now, timer, remaining, elapsed, candles, finish]);

  const start = () => {
    const t = Date.now();
    lastMinute.current = 0;
    lastCandles.current = 6;
    sfx('candle');
    persist({ ...timer, phase: 'running', startedAt: t, accumulatedMs: 0, segmentStart: t });
    setNow(t);
  };
  const pause = () => persist({ ...timer, phase: 'paused', accumulatedMs: elapsedOf(timer, Date.now()), segmentStart: null });
  const resume = () => {
    persist({ ...timer, phase: 'running', segmentStart: Date.now() });
    setNow(Date.now());
  };
  const stop = () => {
    const mins = Math.floor(elapsedOf(timer, Date.now()) / 60_000);
    if (mins < 1) {
      persist({ ...timer, phase: 'idle', startedAt: null, accumulatedMs: 0, segmentStart: null });
      return;
    }
    Alert.alert('End session early?', `Record ${mins} minute${mins > 1 ? 's' : ''} of ${KIND_LABEL[timer.kind].toLowerCase()}?`, [
      { text: 'Keep going', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => persist({ ...timer, phase: 'idle', startedAt: null, accumulatedMs: 0, segmentStart: null }) },
      { text: 'Record', onPress: () => void finish(false, timer) },
    ]);
  };

  const stats = useMemo(() => {
    const today = dayKey();
    const weekAgo = addDays(new Date(), -7).getTime();
    const focusOnly = focus.filter(f => f.kind === 'pomodoro' || f.kind === 'custom');
    return {
      today: focusOnly.filter(f => dayKey(new Date(f.started_at)) === today).reduce((s, f) => s + f.actual_minutes, 0),
      sessionsToday: focusOnly.filter(f => dayKey(new Date(f.started_at)) === today && f.completed).length,
      week: focusOnly.filter(f => new Date(f.started_at).getTime() >= weekAgo).reduce((s, f) => s + f.actual_minutes, 0),
      recent: focus.slice(0, 8),
    };
  }, [focus]);

  const idle = timer.phase === 'idle';
  const linked = openQuests.find(q => q.id === timer.questId);

  return (
    <Screen art="night" dim={0.82} tabs={false}>
      <SubHeader title="Focus Chamber" subtitle={idle ? 'Light the candles and begin.' : `${KIND_LABEL[timer.kind]} in progress`} />
      <Panel>
        <View style={styles.timerWrap}>
          <Glow size={260} color={timer.kind.includes('break') ? '#60A5FA' : '#FFB347'} style={{ top: -40 }} min={0.18} max={0.38} />
          <GText variant="label" color={colors.gold}>
            {KIND_LABEL[timer.kind]}
          </GText>
          <GText style={styles.timer} accessibilityRole="timer" accessibilityLabel={`${fmt(idle ? plannedMs : remaining)} remaining`}>
            {fmt(idle ? plannedMs : remaining)}
          </GText>
          <CandleRow lit={candles} height={80} flicker={timer.phase === 'running'} />
          {linked ? (
            <GText variant="caption" muted style={{ marginTop: 10 }}>
              Focusing on: {linked.title}
            </GText>
          ) : null}
        </View>
        {idle ? (
          <PrimaryButton label="Light the candles" icon="▶" sound={null} onPress={start} />
        ) : (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {timer.phase === 'running' ? (
              <PrimaryButton label="Pause" sound="menu" onPress={pause} style={{ flex: 1 }} />
            ) : (
              <PrimaryButton label="Resume" sound="candle" onPress={resume} style={{ flex: 1 }} />
            )}
            <GhostButton label="End" onPress={stop} style={{ flex: 1 }} />
          </View>
        )}
      </Panel>

      {idle ? (
        <Panel title="Session">
          <View style={styles.wrap}>
            {(Object.keys(KIND_LABEL) as FocusKind[]).map(k => (
              <Chip key={k} label={`${KIND_LABEL[k]}${k === 'custom' ? '' : ` ${durations[k]}m`}`} active={timer.kind === k} onPress={() => setTimer(t => ({ ...t, kind: k, planned: k === 'custom' ? t.planned : durations[k] }))} />
            ))}
          </View>
          {timer.kind === 'custom' ? <Stepper label="Minutes" value={timer.planned} min={5} max={120} step={5} onChange={v => setTimer(t => ({ ...t, planned: v }))} /> : null}
          {(timer.kind === 'pomodoro' || timer.kind === 'custom') && openQuests.length > 0 ? (
            <>
              <GText variant="caption" muted style={{ marginTop: 8, marginBottom: 6 }}>
                Link a quest (optional)
              </GText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Chip label="None" active={!timer.questId} onPress={() => setTimer(t => ({ ...t, questId: null }))} color={colors.purpleSoft} />
                {openQuests.slice(0, 12).map(q => (
                  <Chip key={q.id} label={q.title.length > 22 ? `${q.title.slice(0, 21)}…` : q.title} active={timer.questId === q.id} onPress={() => setTimer(t => ({ ...t, questId: q.id }))} />
                ))}
              </ScrollView>
            </>
          ) : null}
          <GText variant="caption" muted style={{ marginTop: 8 }}>
            Focus earns 5 XP per 5 minutes (max 60 per session, 240 minutes per day). Breaks restore you, not XP.
          </GText>
        </Panel>
      ) : null}

      <Panel title="Focus statistics">
        <View style={styles.statRow}>
          <View style={styles.stat}>
            <GText variant="title">{stats.today}m</GText>
            <GText variant="caption" muted>
              Today
            </GText>
          </View>
          <View style={styles.stat}>
            <GText variant="title">{stats.sessionsToday}</GText>
            <GText variant="caption" muted>
              Sessions today
            </GText>
          </View>
          <View style={styles.stat}>
            <GText variant="title">{stats.week}m</GText>
            <GText variant="caption" muted>
              Last 7 days
            </GText>
          </View>
        </View>
      </Panel>

      <Panel title="Focus history">
        {stats.recent.length === 0 ? (
          <GText variant="body" muted>
            No sessions yet.
          </GText>
        ) : (
          stats.recent.map(f => (
            <View key={f.id} style={styles.entry}>
              <View style={{ flex: 1 }}>
                <GText variant="body" style={{ fontWeight: '700' }}>
                  {KIND_LABEL[f.kind]} · {f.actual_minutes}/{f.planned_minutes}m
                </GText>
                <GText variant="caption" muted>
                  {formatShortDate(f.started_at)}
                  {f.sync_status === 'pending' ? ' · awaiting verification' : ''}
                </GText>
              </View>
              <GText variant="heading" color={colors.gold}>
                {f.xp_awarded ? `+${f.xp_awarded}` : '—'}
              </GText>
            </View>
          ))
        )}
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  timerWrap: { alignItems: 'center', paddingVertical: 12, marginBottom: 12 },
  timer: { fontSize: 64, fontWeight: '900', color: colors.text, letterSpacing: 2, marginVertical: 6, fontVariant: ['tabular-nums'] },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  statRow: { flexDirection: 'row' },
  stat: { flex: 1, alignItems: 'center' },
  entry: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.panelBorder },
});
