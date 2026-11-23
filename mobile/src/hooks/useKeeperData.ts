import { useMemo } from 'react';
import { sfx } from '../audio/useAudioScene';
import { dayKey } from '../domain/dates';
import { activeRegion, levelProgress, worldRestoration } from '../domain/progression';
import type { Quest, QuestHistory, Ritual } from '../domain/types';
import { isRitualDueOn, periodKeyFor, ritualStreak, useKeeper } from '../store/keeperStore';
import { toast } from '../store/uiStore';

const PRIORITY_RANK = { urgent: 0, high: 1, medium: 2, low: 3 } as const;

export function isDoneThisPeriod(q: Quest, history: QuestHistory[]): boolean {
  if (q.recurrence === 'none') return q.status === 'completed';
  const period = periodKeyFor(q);
  return history.some(h => h.quest_id === q.id && h.period_key === period);
}

export function sortQuests(list: Quest[]): Quest[] {
  return [...list].sort((a, b) => {
    const da = a.deadline ? new Date(a.deadline).getTime() : Infinity;
    const db = b.deadline ? new Date(b.deadline).getTime() : Infinity;
    if (da !== db) return da - db;
    return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  });
}

export function useOpenQuests() {
  const quests = useKeeper(s => s.quests);
  const history = useKeeper(s => s.history);
  return useMemo(
    () => sortQuests(quests.filter(q => q.status === 'active' && !isDoneThisPeriod(q, history))),
    [quests, history],
  );
}

export function useTodayRituals() {
  const rituals = useKeeper(s => s.rituals);
  const completions = useKeeper(s => s.completions);
  return useMemo(() => {
    const today = new Date();
    const key = dayKey(today);
    const active = rituals.filter(r => !r.is_archived);
    const due = active.filter(r => isRitualDueOn(r, today));
    const doneIds = new Set(completions.filter(c => c.completion_date === key).map(c => c.ritual_id));
    const streaks = new Map<string, number>(active.map(r => [r.id, ritualStreak(r, completions, today)]));
    return { all: active, due, doneIds, doneCount: due.filter(r => doneIds.has(r.id)).length, streaks };
  }, [rituals, completions]);
}

export function useProgress() {
  const display = useKeeper(s => s.display);
  return useMemo(() => {
    const lp = levelProgress(display.stats.xp);
    const region = activeRegion(display.world);
    return { display, level: lp, region, restoration: worldRestoration(display.world) };
  }, [display]);
}

/** Completion handlers with audio + Keeper feedback, shared by Home and Quests. */
export function useCompletionActions() {
  const completeQuest = useKeeper(s => s.completeQuest);
  const completeRitual = useKeeper(s => s.completeRitual);
  return {
    async onCompleteQuest(q: Quest) {
      const res = await completeQuest(q.id);
      if (!res) return;
      sfx('questComplete', { restart: true });
      toast({
        tone: 'keeper',
        title: res.capped ? 'Quest complete' : 'Great job, Keeper!',
        message: res.capped ? 'Daily reward limit reached for this tier, so no XP this time.' : `"${q.title}" awakened a forgotten soul.`,
        xp: res.xp || undefined,
      });
    },
    async onCompleteRitual(r: Ritual) {
      const res = await completeRitual(r.id);
      if ('error' in res) {
        toast({ tone: 'info', title: 'Ritual', message: res.error === 'already_completed' ? 'Already done today.' : 'Not scheduled right now.' });
        return;
      }
      sfx('candle', { restart: true });
      setTimeout(() => sfx('reward'), 250);
      toast({ tone: 'keeper', title: 'A candle is lit', message: `"${r.title}" kept. The fog thins.`, xp: res.xp });
    },
  };
}
