import React, { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { sfx, useAudioScene } from '../audio/useAudioScene';
import { DarkKeeper, type KeeperMood } from '../components/characters';
import { DifficultyBadge } from '../components/game';
import { HauntedBackground } from '../components/HauntedBackground';
import { SubHeader } from '../components/SubHeader';
import { Chip, GText, GhostButton, PressableScale, PrimaryButton } from '../components/ui';
import { QUEST_XP } from '../domain/constants';
import type { Difficulty } from '../domain/types';
import { useMotion } from '../hooks/useMotion';
import type { RootScreenProps } from '../navigation/types';
import {
  AiError,
  askDarkKeeper,
  cacheConversation,
  decideProposal,
  loadLatestConversation,
  readCachedConversation,
  type AiMessage,
  type AiMode,
  type AiProposal,
} from '../services/ai';
import { useKeeper } from '../store/keeperStore';
import { useSession } from '../store/sessionStore';
import { toast } from '../store/uiStore';
import { colors, radii } from '../theme';

const MODES: { mode: AiMode; label: string; template: string }[] = [
  { mode: 'chat', label: 'Chat', template: '' },
  { mode: 'breakdown', label: 'Break down a goal', template: 'Break this goal into quests: ' },
  { mode: 'generate_quests', label: 'Generate quests', template: 'Create quests to help me ' },
  { mode: 'daily_plan', label: 'Plan my day', template: 'Plan my day based on my quests and rituals.' },
  { mode: 'weekly_review', label: 'Weekly review', template: 'Review my last week and tell me what to improve.' },
  { mode: 'habit_suggestions', label: 'Habit ideas', template: 'Suggest rituals that help me ' },
];

function ProposalCard({ proposal, onDecide, busy }: { proposal: AiProposal; onDecide: (p: AiProposal, approve: boolean) => void; busy: boolean }) {
  const p = proposal.payload;
  const isQuest = proposal.kind === 'quest';
  const diff = (p.difficulty ?? 'medium') as Difficulty;
  return (
    <View style={styles.proposal} accessible={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {isQuest ? <DifficultyBadge difficulty={diff} size={30} /> : <GText style={{ fontSize: 26 }}>🕯️</GText>}
        <View style={{ flex: 1, marginLeft: 10 }}>
          <GText variant="body" style={{ fontWeight: '800' }}>
            {p.title}
          </GText>
          <GText variant="caption" muted>
            {isQuest ? `Quest · ${diff} · +${QUEST_XP[diff] ?? 25} XP${p.deadline_days != null ? ` · due in ${p.deadline_days}d` : ''}` : `Ritual · ${p.schedule_type ?? 'daily'} · +15 XP`}
          </GText>
        </View>
      </View>
      {p.description ? (
        <GText variant="caption" muted style={{ marginTop: 6 }}>
          {p.description}
        </GText>
      ) : null}
      {proposal.status === 'pending' ? (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          <PrimaryButton label="Approve" sound={null} disabled={busy} onPress={() => onDecide(proposal, true)} style={{ flex: 1, paddingVertical: 8 }} />
          <GhostButton label="Reject" sound="whisper" onPress={() => onDecide(proposal, false)} style={{ flex: 1, paddingVertical: 8 }} />
        </View>
      ) : (
        <GText variant="caption" color={proposal.status === 'approved' ? colors.green : colors.textFaint} style={{ marginTop: 8 }}>
          {proposal.status === 'approved' ? `✓ Added to your ${isQuest ? 'quests' : 'rituals'}` : 'Rejected'}
        </GText>
      )}
    </View>
  );
}

export function DarkKeeperScreen({ route }: RootScreenProps<'DarkKeeper'>) {
  useAudioScene('keeper');
  const insets = useSafeAreaInsets();
  const { reduceMotion } = useMotion();
  const status = useSession(s => s.status);
  const online = useKeeper(s => s.sync.online);
  const [mode, setMode] = useState<AiMode>(route.params?.mode ?? 'chat');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [mood, setMood] = useState<KeeperMood>('idle');
  const [sending, setSending] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const listRef = useRef<FlatList<AiMessage>>(null);
  const moodTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const available = status === 'signedIn';
  const unavailableReason = status === 'guest' ? 'The Dark Keeper speaks through the Graveyard server. Create an account to unlock AI counsel.' : !online ? 'You are offline. The Dark Keeper will answer when the connection returns.' : null;

  const setMoodFor = (m: KeeperMood, ms = 2600) => {
    setMood(m);
    if (moodTimer.current) clearTimeout(moodTimer.current);
    moodTimer.current = setTimeout(() => setMood('idle'), ms);
  };

  useEffect(() => {
    let alive = true;
    void readCachedConversation().then(c => {
      if (!alive) return;
      setConversationId(c.conversationId);
      setMessages(c.messages);
    });
    if (available) {
      loadLatestConversation()
        .then(c => {
          if (!alive || !c) return;
          setConversationId(c.conversationId);
          setMessages(c.messages);
          void cacheConversation(c);
        })
        .catch(() => undefined);
    }
    return () => {
      alive = false;
      if (moodTimer.current) clearTimeout(moodTimer.current);
    };
  }, [available]);

  useEffect(() => {
    const m = MODES.find(x => x.mode === route.params?.mode);
    if (m) {
      setMode(m.mode);
      setInput(m.template);
    }
  }, [route.params?.mode]);

  const update = (next: AiMessage[], conv = conversationId) => {
    setMessages(next);
    void cacheConversation({ conversationId: conv, messages: next });
  };

  const send = async () => {
    const text = input.trim();
    if (!text || sending || !available) return;
    setSending(true);
    setMood('thinking');
    sfx('magicTransition');
    const temp: AiMessage = { id: `local-${Date.now()}`, role: 'user', mode, content: text, created_at: new Date().toISOString(), proposals: [] };
    const base = [...messages.filter(m => !m.failed), temp];
    setMessages(base);
    setInput('');
    try {
      const res = await askDarkKeeper({ conversationId, mode, message: text });
      const next = [...base.slice(0, -1), { ...res.user_message, proposals: [] }, { ...res.message, proposals: res.proposals ?? [] }];
      setConversationId(res.conversation_id);
      update(next, res.conversation_id);
      sfx('whisper');
      setMoodFor('talking', 3200);
    } catch (e) {
      const msg = e instanceof AiError ? e.message : 'The fog swallowed your message.';
      setMessages([...base, { id: `err-${Date.now()}`, role: 'assistant', mode, content: msg, created_at: new Date().toISOString(), proposals: [], failed: true }]);
      setInput(text);
      setMoodFor('error', 2400);
    } finally {
      setSending(false);
    }
  };

  const decide = async (proposal: AiProposal, approve: boolean) => {
    setDeciding(true);
    try {
      await decideProposal(proposal.id, approve);
      const next = messages.map(m => ({ ...m, proposals: m.proposals.map(p => (p.id === proposal.id ? { ...p, status: approve ? ('approved' as const) : ('rejected' as const) } : p)) }));
      update(next);
      if (approve) {
        sfx('spell');
        setMoodFor('celebrating', 2400);
        toast({ tone: 'keeper', title: proposal.kind === 'quest' ? 'Quest inscribed' : 'Ritual bound', message: proposal.payload.title });
      }
    } catch (e) {
      toast({ tone: 'error', title: 'Could not apply', message: (e as Error).message });
      setMoodFor('error');
    } finally {
      setDeciding(false);
    }
  };

  const newConversation = () => {
    setConversationId(null);
    update([], null);
    setMood('idle');
  };

  return (
    <View style={{ flex: 1 }}>
      <HauntedBackground art="haunted" dim={0.78} bats={false} />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 16 }}>
          <SubHeader title="Dark Keeper" subtitle="Your mysterious guide" right={<GhostButton label="New" onPress={newConversation} style={{ paddingVertical: 8 }} />} />
          <View style={styles.keeperRow}>
            <DarkKeeper mood={sending ? 'thinking' : mood} size={110} />
            <View style={styles.intro}>
              <GText variant="body" color={colors.parchmentInk} style={{ fontWeight: '700' }}>
                {sending ? 'Consulting the spirits…' : mood === 'error' ? 'The fog is thick tonight…' : 'Speak, Keeper. I can break down goals, plan your day, review your week, or suggest rituals.'}
              </GText>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 6 }}>
            {MODES.map(m => (
              <Chip
                key={m.mode}
                label={m.label}
                active={mode === m.mode}
                color={colors.purpleSoft}
                onPress={() => {
                  setMode(m.mode);
                  if (!input.trim() || MODES.some(x => x.template === input)) setInput(m.template);
                }}
              />
            ))}
          </ScrollView>
        </View>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={m => m.id}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: !reduceMotion })}
          ListEmptyComponent={
            <GText variant="body" muted style={{ textAlign: 'center', marginTop: 20 }}>
              {unavailableReason ?? 'Ask anything about your goals. Quests the Dark Keeper proposes are only added after you approve them.'}
            </GText>
          }
          renderItem={({ item }) => (
            <Animated.View entering={reduceMotion ? undefined : FadeInUp.duration(300)} style={[styles.bubble, item.role === 'user' ? styles.user : styles.keeper, item.failed && styles.failed]}>
              <GText variant="body" color={item.role === 'user' ? colors.text : colors.parchmentInk} style={{ fontWeight: item.role === 'user' ? '600' : '700' }}>
                {item.content}
              </GText>
              {item.proposals.map(p => (
                <ProposalCard key={p.id} proposal={p} busy={deciding} onDecide={decide} />
              ))}
            </Animated.View>
          )}
        />
        <View style={[styles.inputRow, { paddingBottom: insets.bottom + 10 }]}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={available ? 'Ask the Dark Keeper…' : 'AI requires an account and a connection'}
            placeholderTextColor={colors.textFaint}
            editable={available && !sending}
            multiline
            maxLength={2000}
            style={styles.input}
            accessibilityLabel="Message to the Dark Keeper"
          />
          <PressableScale sound={null} disabled={!available || sending || !input.trim()} onPress={send} style={styles.send} accessibilityLabel="Send message">
            <GText variant="title" color={colors.parchmentInk}>
              ➤
            </GText>
          </PressableScale>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  keeperRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  intro: { flex: 1, backgroundColor: colors.parchment, borderRadius: radii.lg, padding: 10, borderWidth: 3, borderColor: '#C9A86A', marginLeft: 8 },
  bubble: { borderRadius: radii.lg, padding: 12, marginVertical: 5, maxWidth: '92%' },
  user: { alignSelf: 'flex-end', backgroundColor: '#3B1F7A', borderWidth: 2, borderColor: colors.purpleSoft },
  keeper: { alignSelf: 'flex-start', backgroundColor: colors.parchment, borderWidth: 2, borderColor: '#C9A86A' },
  failed: { backgroundColor: '#FDE2E2', borderColor: colors.red },
  proposal: { backgroundColor: 'rgba(27,24,56,0.95)', borderRadius: radii.md, padding: 10, marginTop: 10, borderWidth: 2, borderColor: colors.panelBorder },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingTop: 8, backgroundColor: 'rgba(11,10,26,0.95)', borderTopWidth: 2, borderTopColor: colors.panelBorder },
  input: { flex: 1, minHeight: 48, maxHeight: 130, borderRadius: radii.md, borderWidth: 2, borderColor: colors.panelBorder, backgroundColor: colors.navy, color: colors.text, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  send: { width: 52, height: 48, borderRadius: radii.md, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
});
