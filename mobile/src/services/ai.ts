import { FunctionsHttpError } from '@supabase/supabase-js';
import { getSupabase } from './supabase';
import { kvRepo } from '../db/repositories';
import type { Quest, Ritual } from '../domain/types';
import { useKeeper } from '../store/keeperStore';

export type AiMode = 'chat' | 'breakdown' | 'generate_quests' | 'daily_plan' | 'weekly_review' | 'habit_suggestions';

export interface AiProposal {
  id: string;
  kind: 'quest' | 'ritual';
  status: 'pending' | 'approved' | 'rejected';
  payload: {
    title: string;
    description?: string;
    difficulty?: string;
    priority?: string;
    deadline_days?: number | null;
    category?: string | null;
    schedule_type?: string;
  };
}

export interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  mode: AiMode;
  content: string;
  created_at: string;
  proposals: AiProposal[];
  failed?: boolean;
}

export interface AiConversationCache {
  conversationId: string | null;
  messages: AiMessage[];
}

const ERRORS: Record<string, string> = {
  rate_limited: 'The Dark Keeper needs a moment. Try again in a minute.',
  daily_limit_reached: 'You have used today\'s counsel. Return tomorrow, Keeper.',
  token_budget_exhausted: 'Today\'s spirit energy for counsel is spent. Return tomorrow.',
  ai_not_configured: 'The Dark Keeper is not configured on the server yet (missing LLM key).',
  provider_timeout: 'The spirits took too long to answer. Try again.',
  provider_unavailable: 'The spirit realm is unreachable right now. Try again soon.',
  provider_rejected: 'The spirit realm rejected the request. Check the server LLM settings.',
  not_authenticated: 'Sign in to speak with the Dark Keeper.',
  invalid_message: 'Your message must be between 1 and 2000 characters.',
};

export class AiError extends Error {}

function requireClient() {
  const sb = getSupabase();
  if (!sb) throw new AiError('The Dark Keeper needs the Graveyard backend. Configure Supabase to enable AI.');
  return sb;
}

export async function askDarkKeeper(params: { conversationId: string | null; mode: AiMode; message: string }) {
  const sb = requireClient();
  const { data, error } = await sb.functions.invoke('dark-keeper', {
    body: { conversation_id: params.conversationId, mode: params.mode, message: params.message },
  });
  if (error) {
    let code = '';
    if (error instanceof FunctionsHttpError) {
      try {
        code = (await error.context.json())?.error ?? '';
      } catch {
        code = '';
      }
    }
    throw new AiError(ERRORS[code] ?? 'The fog swallowed your message. Check your connection and try again.');
  }
  return data as {
    conversation_id: string;
    user_message: Omit<AiMessage, 'proposals'>;
    message: Omit<AiMessage, 'proposals'>;
    proposals: AiProposal[];
  };
}

export async function loadLatestConversation(): Promise<AiConversationCache | null> {
  const sb = requireClient();
  const { data: conv, error } = await sb
    .from('ai_conversations')
    .select('id')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!conv) return { conversationId: null, messages: [] };
  const [msgs, props] = await Promise.all([
    sb.from('ai_messages').select('id, role, mode, content, created_at').eq('conversation_id', conv.id).order('created_at').limit(100),
    sb.from('ai_proposals').select('id, kind, status, payload, message_id').eq('conversation_id', conv.id),
  ]);
  if (msgs.error) throw msgs.error;
  const byMessage = new Map<string, AiProposal[]>();
  (props.data ?? []).forEach(p => {
    const list = byMessage.get(p.message_id) ?? [];
    list.push({ id: p.id, kind: p.kind, status: p.status, payload: p.payload });
    byMessage.set(p.message_id, list);
  });
  return {
    conversationId: conv.id,
    messages: (msgs.data ?? []).map(m => ({ ...(m as Omit<AiMessage, 'proposals'>), proposals: byMessage.get(m.id) ?? [] })),
  };
}

export async function decideProposal(id: string, approve: boolean) {
  const sb = requireClient();
  const { data, error } = await sb.rpc('decide_ai_proposal', { p_proposal_id: id, p_approve: approve });
  if (error) throw new AiError('Could not reach the Graveyard. Try again when online.');
  const result = data as { ok: boolean; error?: string; status?: string; kind?: 'quest' | 'ritual'; entity?: Quest | Ritual };
  if (!result.ok) throw new AiError(result.error === 'proposal_already_decided' ? 'This proposal was already decided.' : 'This proposal could not be applied.');
  if (result.entity && result.kind === 'quest') await useKeeper.getState().addServerQuest(result.entity as Quest);
  if (result.entity && result.kind === 'ritual') {
    const r = result.entity as Ritual;
    await useKeeper.getState().addServerRitual({ ...r, schedule_days: r.schedule_days ?? [], reminder_time: r.reminder_time?.slice(0, 5) ?? null });
  }
  return result;
}

export const cacheConversation = (c: AiConversationCache) => kvRepo.set('ai.cache', { ...c, messages: c.messages.slice(-60) });
export const readCachedConversation = () => kvRepo.get<AiConversationCache>('ai.cache', { conversationId: null, messages: [] });
