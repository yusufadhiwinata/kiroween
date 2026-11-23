// Dark Keeper — GRAVEYARD's AI productivity companion.
// Flow: app -> this Edge Function (JWT verified) -> OpenAI-compatible LLM -> validated JSON -> app.
// The LLM key lives only in Edge Function secrets (LLM_API_KEY); it never ships in the APK.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

const MODES = ['chat', 'breakdown', 'generate_quests', 'daily_plan', 'weekly_review', 'habit_suggestions'] as const;
type Mode = (typeof MODES)[number];

const DIFFICULTIES = ['easy', 'medium', 'hard', 'boss'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const CATEGORIES = ['work', 'study', 'health', 'personal', 'home', 'creative'];

const LIMIT_PER_MINUTE = 6;
const LIMIT_PER_DAY = 120;
const DAILY_TOKEN_BUDGET = 150_000;
const MAX_MESSAGE_CHARS = 2000;
const REQUEST_TIMEOUT_MS = 25_000;
const MAX_ATTEMPTS = 3;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

type Proposal = {
  kind: 'quest' | 'ritual';
  title: string;
  description: string;
  difficulty?: string;
  priority?: string;
  deadline_days?: number | null;
  category?: string | null;
  schedule_type?: 'daily' | 'weekly';
};

class ProviderError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const MODE_INSTRUCTIONS: Record<Mode, string> = {
  chat:
    'Answer the Keeper conversationally with practical advice. Only include proposals if the Keeper explicitly asks for tasks or a plan.',
  breakdown:
    'Break the Keeper\'s goal into 3-7 concrete, sequential quests. Each quest must be completable in one sitting. Assign realistic difficulty.',
  generate_quests:
    'Generate 3-6 actionable quests that move the Keeper toward what they described. Prefer specific verbs and measurable outcomes.',
  daily_plan:
    'Build a realistic plan for today from the active quests and rituals in context: order them, suggest focus blocks (Pomodoro), and keep it achievable. Propose at most 3 new quests only if there is an obvious gap.',
  weekly_review:
    'Review the last 7 days from the stats in context: celebrate wins, name one pattern, give 1-3 concrete adjustments for next week. Propose at most 3 quests that fix the biggest gap.',
  habit_suggestions:
    'Suggest 2-4 small, sustainable rituals (habits) that fit the Keeper\'s goals. Use proposals with kind "ritual".',
};

function systemPrompt(mode: Mode, context: string): string {
  return [
    'You are the Dark Keeper, the hooded guardian spirit of GRAVEYARD, a Halloween world restored by real-life productivity.',
    'Persona: mysterious, warm, encouraging, lightly spooky (lanterns, souls, fog) but never scary or condescending.',
    'Give concrete, practical help. Keep "reply" under 120 words; put the actionable steps in "proposals", not in the reply. Reply in the same language the Keeper writes in.',
    'Never invent stats; rely only on the context below. Never ask for passwords or personal secrets.',
    '',
    `Task mode: ${mode}. ${MODE_INSTRUCTIONS[mode]}`,
    '',
    'Respond ONLY with one raw JSON object (no markdown, no code fences, no text before or after) of this exact shape:',
    '{"reply": string, "proposals": [{"kind": "quest" | "ritual", "title": string (<= 80 chars), "description": string (<= 200 chars),',
    ' "difficulty": "easy"|"medium"|"hard"|"boss", "priority": "low"|"medium"|"high"|"urgent", "deadline_days": integer 0-30 or null,',
    ` "category": one of ${JSON.stringify(CATEGORIES)} or null, "schedule_type": "daily"|"weekly" (rituals only)}]}`,
    'Use "proposals": [] when no tasks are needed. Difficulty guide: easy <30 min, medium 30-90 min, hard half-day, boss multi-day milestone.',
    '',
    'Keeper context:',
    context,
  ].join('\n');
}

async function buildContext(db: SupabaseClient, userId: string): Promise<string> {
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [profile, stats, quests, rituals, history, completions, focus] = await Promise.all([
    db.from('profiles').select('display_name, timezone').eq('id', userId).maybeSingle(),
    db.from('keeper_stats').select('level, xp, soul_energy, current_streak, longest_streak, quests_completed').eq('user_id', userId).maybeSingle(),
    db.from('quests').select('title, difficulty, priority, deadline, recurrence')
      .eq('user_id', userId).eq('status', 'active').is('deleted_at', null)
      .order('deadline', { ascending: true, nullsFirst: false }).limit(15),
    db.from('rituals').select('title, schedule_type, schedule_days')
      .eq('user_id', userId).eq('is_archived', false).is('deleted_at', null).limit(12),
    db.from('quest_history').select('difficulty, xp_awarded').eq('user_id', userId).gte('completed_at', since),
    db.from('ritual_completions').select('ritual_id').eq('user_id', userId).gte('completed_at', since),
    db.from('focus_sessions').select('actual_minutes, kind').eq('user_id', userId).gte('started_at', since),
  ]);
  const tz = profile.data?.timezone ?? 'UTC';
  let today = new Date().toISOString().slice(0, 10);
  try {
    today = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  } catch (_) {
    // invalid timezone -> keep UTC date
  }
  const focusMinutes = (focus.data ?? [])
    .filter((f) => f.kind === 'pomodoro' || f.kind === 'custom')
    .reduce((sum, f) => sum + (f.actual_minutes ?? 0), 0);
  const ctx = {
    keeper: profile.data?.display_name ?? 'Keeper',
    today,
    timezone: tz,
    stats: stats.data ?? null,
    active_quests: (quests.data ?? []).map((q) => ({
      title: q.title,
      difficulty: q.difficulty,
      priority: q.priority,
      deadline: q.deadline ? String(q.deadline).slice(0, 16) : null,
      recurrence: q.recurrence,
    })),
    rituals: rituals.data ?? [],
    last_7_days: {
      quests_completed: history.data?.length ?? 0,
      xp_from_quests: (history.data ?? []).reduce((s, h) => s + (h.xp_awarded ?? 0), 0),
      ritual_check_ins: completions.data?.length ?? 0,
      focus_minutes: focusMinutes,
    },
  };
  return JSON.stringify(ctx);
}

async function callLLM(messages: ChatMessage[]) {
  const apiKey = Deno.env.get('LLM_API_KEY');
  if (!apiKey) throw new ProviderError('ai_not_configured', 503);
  const base = (Deno.env.get('LLM_BASE_URL') ?? 'https://api.openai.com/v1').replace(/\/+$/, '');
  const model = Deno.env.get('LLM_MODEL') ?? 'gpt-4o-mini';
  const jsonMode = (Deno.env.get('LLM_JSON_MODE') ?? 'true') !== 'false';

  let lastError: unknown = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.7,
          // Room for the reply plus up to 8 proposals; truncated JSON is salvaged by parseModelOutput.
          max_tokens: 2000,
          ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
        }),
        signal: controller.signal,
      });
      if (res.status === 429 || res.status >= 500) {
        lastError = new ProviderError(`provider_${res.status}`, 502);
      } else if (!res.ok) {
        const detail = (await res.text()).slice(0, 300);
        console.error('LLM provider rejected request', res.status, detail);
        throw new ProviderError('provider_rejected', 502);
      } else {
        const data = await res.json();
        return {
          content: String(data?.choices?.[0]?.message?.content ?? ''),
          promptTokens: Number(data?.usage?.prompt_tokens ?? 0),
          completionTokens: Number(data?.usage?.completion_tokens ?? 0),
          model: String(data?.model ?? model),
        };
      }
    } catch (err) {
      if (err instanceof ProviderError && err.message === 'provider_rejected') throw err;
      lastError = err instanceof DOMException && err.name === 'AbortError'
        ? new ProviderError('provider_timeout', 504)
        : err;
    } finally {
      clearTimeout(timer);
    }
    await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
  }
  throw lastError instanceof ProviderError ? lastError : new ProviderError('provider_unavailable', 502);
}

function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : raw;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  return start >= 0 && end > start ? body.slice(start, end + 1) : body;
}

function clean(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

function sanitizeProposal(p: unknown): Proposal | null {
  if (!p || typeof p !== 'object') return null;
  const o = p as Record<string, unknown>;
  const kind = o.kind === 'ritual' ? 'ritual' : 'quest';
  const title = clean(o.title, kind === 'quest' ? 120 : 80);
  if (!title) return null;
  const description = clean(o.description, 400);
  if (kind === 'ritual') {
    return { kind, title, description, schedule_type: o.schedule_type === 'weekly' ? 'weekly' : 'daily' };
  }
  const days = Number(o.deadline_days);
  const category = typeof o.category === 'string' ? o.category.toLowerCase() : '';
  return {
    kind,
    title,
    description,
    difficulty: DIFFICULTIES.includes(String(o.difficulty)) ? String(o.difficulty) : 'medium',
    priority: PRIORITIES.includes(String(o.priority)) ? String(o.priority) : 'medium',
    deadline_days: Number.isInteger(days) && days >= 0 && days <= 30 ? days : null,
    category: CATEGORIES.includes(category) ? category : null,
  };
}

function toProposals(list: unknown[]): Proposal[] {
  return list.slice(0, 8).map(sanitizeProposal).filter((p): p is Proposal => p !== null);
}

/**
 * Recovers what it can from JSON that was cut off (e.g. the model hit max_tokens):
 * the "reply" string (complete or partial) and every fully closed proposal object.
 */
function salvageJson(raw: string): { reply: string; proposals: Proposal[] } | null {
  const replyMatch = raw.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)("?)/);
  if (!replyMatch) return null;
  let reply = '';
  try {
    reply = JSON.parse(`"${replyMatch[1].replace(/\\$/, '')}"`);
  } catch (_) {
    reply = replyMatch[1].replace(/\\n/g, ' ').replace(/\\"/g, '"');
  }
  const found: unknown[] = [];
  const start = raw.indexOf('"proposals"');
  if (start >= 0) {
    let depth = 0;
    let objStart = -1;
    let inString = false;
    for (let i = raw.indexOf('[', start) + 1; i > 0 && i < raw.length; i++) {
      const ch = raw[i];
      if (inString) {
        if (ch === '\\') i++;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') inString = true;
      else if (ch === '{') {
        if (depth === 0) objStart = i;
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0 && objStart >= 0) {
          try {
            found.push(JSON.parse(raw.slice(objStart, i + 1)));
          } catch (_) {
            // skip malformed object
          }
          objStart = -1;
        }
      } else if (ch === ']' && depth === 0) break;
    }
  }
  const complete = replyMatch[2] === '"';
  return { reply: clean(reply, 4000) + (complete ? '' : '…'), proposals: toProposals(found) };
}

function parseModelOutput(raw: string): { reply: string; proposals: Proposal[] } {
  try {
    const obj = JSON.parse(extractJson(raw));
    const reply = clean(obj?.reply, 4000) || 'The lanterns flicker... I have gathered some quests for you.';
    const proposals = Array.isArray(obj?.proposals) ? toProposals(obj.proposals) : [];
    return { reply, proposals };
  } catch (_) {
    const salvaged = salvageJson(raw);
    if (salvaged && salvaged.reply) return salvaged;
    // Model ignored the JSON contract: keep the text, drop structured proposals.
    return { reply: clean(raw, 4000) || 'The fog is too thick to answer right now. Ask me again, Keeper.', proposals: [] };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'not_authenticated' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: auth, error: authError } = await admin.auth.getUser(authHeader.slice(7));
  if (authError || !auth?.user) return json({ error: 'not_authenticated' }, 401);
  const userId = auth.user.id;

  // ---- input validation ----
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch (_) {
    return json({ error: 'invalid_json' }, 400);
  }
  const mode = MODES.includes(body.mode as Mode) ? (body.mode as Mode) : null;
  if (!mode) return json({ error: 'invalid_mode' }, 400);
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message || message.length > MAX_MESSAGE_CHARS) return json({ error: 'invalid_message' }, 400);
  const requestedConversation = body.conversation_id;
  if (requestedConversation != null && (typeof requestedConversation !== 'string' || !UUID_RE.test(requestedConversation))) {
    return json({ error: 'invalid_conversation_id' }, 400);
  }

  // ---- rate limiting & token budget ----
  const minuteAgo = new Date(Date.now() - 60_000).toISOString();
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  const [perMinute, perDay, tokens] = await Promise.all([
    admin.from('ai_messages').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).eq('role', 'user').gte('created_at', minuteAgo),
    admin.from('ai_messages').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).eq('role', 'user').gte('created_at', dayAgo),
    admin.from('ai_messages').select('prompt_tokens, completion_tokens')
      .eq('user_id', userId).eq('role', 'assistant').gte('created_at', dayAgo),
  ]);
  if ((perMinute.count ?? 0) >= LIMIT_PER_MINUTE) return json({ error: 'rate_limited', retry_after_s: 60 }, 429);
  if ((perDay.count ?? 0) >= LIMIT_PER_DAY) return json({ error: 'daily_limit_reached' }, 429);
  const usedTokens = (tokens.data ?? []).reduce((s, m) => s + m.prompt_tokens + m.completion_tokens, 0);
  if (usedTokens >= DAILY_TOKEN_BUDGET) return json({ error: 'token_budget_exhausted' }, 429);

  // ---- conversation ownership ----
  let conversationId: string;
  if (requestedConversation) {
    const { data: conv } = await admin.from('ai_conversations').select('id')
      .eq('id', requestedConversation).eq('user_id', userId).maybeSingle();
    if (!conv) return json({ error: 'conversation_not_found' }, 404);
    conversationId = conv.id;
  } else {
    const { data: conv, error } = await admin.from('ai_conversations')
      .insert({ user_id: userId, title: clean(message, 60) || 'Dark Keeper counsel' })
      .select('id').single();
    if (error || !conv) return json({ error: 'conversation_create_failed' }, 500);
    conversationId = conv.id;
  }

  const { data: historyRows } = await admin.from('ai_messages').select('role, content')
    .eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(12);
  const history: ChatMessage[] = (historyRows ?? []).reverse().map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  const { data: userMsg, error: userMsgError } = await admin.from('ai_messages')
    .insert({ conversation_id: conversationId, user_id: userId, role: 'user', mode, content: message })
    .select('id, role, mode, content, created_at').single();
  if (userMsgError || !userMsg) return json({ error: 'message_store_failed' }, 500);

  // ---- LLM call ----
  let result: Awaited<ReturnType<typeof callLLM>>;
  try {
    const context = await buildContext(admin, userId);
    result = await callLLM([
      { role: 'system', content: systemPrompt(mode, context) },
      ...history,
      { role: 'user', content: message },
    ]);
  } catch (err) {
    const e = err instanceof ProviderError ? err : new ProviderError('provider_unavailable', 502);
    console.error('Dark Keeper LLM failure', e.message);
    return json({ error: e.message, conversation_id: conversationId, user_message: userMsg }, e.status);
  }

  // ---- response validation & persistence ----
  const parsed = parseModelOutput(result.content);
  const { data: assistantMsg, error: assistantError } = await admin.from('ai_messages')
    .insert({
      conversation_id: conversationId,
      user_id: userId,
      role: 'assistant',
      mode,
      content: parsed.reply,
      prompt_tokens: Number.isFinite(result.promptTokens) ? result.promptTokens : 0,
      completion_tokens: Number.isFinite(result.completionTokens) ? result.completionTokens : 0,
      model: result.model.slice(0, 80),
    })
    .select('id, role, mode, content, created_at').single();
  if (assistantError || !assistantMsg) return json({ error: 'message_store_failed' }, 500);

  let proposals: unknown[] = [];
  if (parsed.proposals.length > 0) {
    const { data } = await admin.from('ai_proposals')
      .insert(parsed.proposals.map((p) => ({
        user_id: userId,
        conversation_id: conversationId,
        message_id: assistantMsg.id,
        kind: p.kind,
        payload: p,
      })))
      .select('id, kind, payload, status, created_at');
    proposals = data ?? [];
  }
  await admin.from('ai_conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId);

  return json({
    conversation_id: conversationId,
    user_message: userMsg,
    message: assistantMsg,
    proposals,
    usage: { prompt_tokens: result.promptTokens, completion_tokens: result.completionTokens },
  });
});
