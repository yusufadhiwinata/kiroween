-- GRAVEYARD v4.0 — server-authoritative progression.
-- Every reward RPC:
--   * requires an authenticated user and only touches that user's rows,
--   * is idempotent on a client-generated operation id (sync_operations.id),
--   * locks keeper_stats FOR UPDATE so concurrent rewards are applied atomically,
--   * derives XP from server data (difficulty, durations), never from the client.

-- ---------------------------------------------------------------------------
-- Pure helpers
-- ---------------------------------------------------------------------------
-- Cumulative XP needed to reach level L+1 from level 1: 100*L + 25*L*(L-1).
create or replace function private.level_for_xp(p_xp integer) returns integer
language plpgsql immutable set search_path = '' as $$
declare
  lvl integer := 1;
begin
  while lvl < 100 and 100 * lvl + 25 * lvl * (lvl - 1) <= p_xp loop
    lvl := lvl + 1;
  end loop;
  return lvl;
end
$$;

create or replace function private.world_state(p_points integer, p_required integer) returns text
language sql immutable set search_path = '' as $$
  select case
    when p_points >= p_required then 'restored'
    when p_points * 100 >= p_required * 60 then 'restoration'
    when p_points * 100 >= p_required * 25 then 'awakening'
    else 'abandoned'
  end
$$;

create or replace function private.quest_xp(p_difficulty text) returns integer
language sql immutable set search_path = '' as $$
  select case p_difficulty
    when 'easy' then 10
    when 'medium' then 25
    when 'hard' then 50
    when 'boss' then 100
    else 0
  end
$$;

create or replace function private.require_user() returns uuid
language plpgsql stable set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  return uid;
end
$$;

create or replace function private.user_tz(p_user uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  tz text;
begin
  select p.timezone into tz from public.profiles p where p.id = p_user;
  perform now() at time zone coalesce(tz, 'UTC');
  return coalesce(tz, 'UTC');
exception when others then
  return 'UTC';
end
$$;

-- ---------------------------------------------------------------------------
-- Idempotency ledger
-- ---------------------------------------------------------------------------
-- Returns NULL when the operation is new (and claims it), or the stored result
-- (flagged duplicate=true) when the same operation id was already processed.
create or replace function private.claim_op(
  p_op uuid, p_user uuid, p_type text, p_entity uuid, p_payload jsonb, p_client_at timestamptz
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  owner uuid;
  stored jsonb;
begin
  if p_op is null then
    raise exception 'op_id_required' using errcode = '22023';
  end if;
  insert into public.sync_operations (id, user_id, op_type, entity_id, payload, status, client_created_at)
  values (p_op, p_user, p_type, p_entity, coalesce(p_payload, '{}'::jsonb), 'processing', p_client_at)
  on conflict (id) do nothing;
  if found then
    return null;
  end if;
  select s.user_id, s.result into owner, stored from public.sync_operations s where s.id = p_op;
  if owner is distinct from p_user then
    raise exception 'op_id_conflict' using errcode = '23505';
  end if;
  return coalesce(stored, '{}'::jsonb) || jsonb_build_object('duplicate', true);
end
$$;

create or replace function private.finish_op(p_op uuid, p_status text, p_result jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  update public.sync_operations
     set status = p_status, result = p_result, processed_at = now()
   where id = p_op;
  return p_result;
end
$$;

-- ---------------------------------------------------------------------------
-- Progression primitives (callers must hold the keeper_stats row lock)
-- ---------------------------------------------------------------------------
create or replace function private.grant_xp(
  p_user uuid, p_type text, p_source_id text, p_key text, p_amount integer, p_note text
) returns integer
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(p_amount, 0) <= 0 then
    return 0;
  end if;
  insert into public.xp_transactions (user_id, amount, source_type, source_id, source_key, note)
  values (p_user, p_amount, p_type, p_source_id, p_key, left(p_note, 140))
  on conflict (user_id, source_type, source_key) do nothing;
  if not found then
    return 0;
  end if;
  update public.keeper_stats
     set xp = xp + p_amount,
         soul_energy = soul_energy + p_amount,
         soul_banked = soul_banked + p_amount,
         level = private.level_for_xp(xp + p_amount),
         updated_at = now()
   where user_id = p_user;
  return p_amount;
end
$$;

-- Unlocks regions by level and channels banked Soul Energy into them, in order.
create or replace function private.sync_world(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  lvl integer;
  banked integer;
  take integer;
  r record;
begin
  select k.level, k.soul_banked into lvl, banked from public.keeper_stats k where k.user_id = p_user;

  update public.world_progress wp
     set state = private.world_state(wp.points, wa.restore_points),
         unlocked_at = now(),
         updated_at = now()
    from public.world_areas wa
   where wp.user_id = p_user and wa.id = wp.area_id
     and wp.state = 'locked' and wa.unlock_level <= lvl;

  for r in
    select wp.area_id, wp.points, wa.restore_points
      from public.world_progress wp
      join public.world_areas wa on wa.id = wp.area_id
     where wp.user_id = p_user and wp.state <> 'locked' and wp.points < wa.restore_points
     order by wa.sort_order
  loop
    exit when banked <= 0;
    take := least(banked, r.restore_points - r.points);
    update public.world_progress
       set points = points + take,
           state = private.world_state(points + take, r.restore_points),
           restored_at = case when points + take >= r.restore_points then now() else restored_at end,
           updated_at = now()
     where user_id = p_user and area_id = r.area_id;
    banked := banked - take;
  end loop;

  update public.keeper_stats set soul_banked = banked where user_id = p_user;
end
$$;

create or replace function private.touch_activity(p_user uuid, p_day date) returns void
language plpgsql security definer set search_path = '' as $$
declare
  last_day date;
  streak integer;
begin
  select k.last_active_date, k.current_streak into last_day, streak
    from public.keeper_stats k where k.user_id = p_user;
  if last_day is null or p_day > last_day + 1 then
    streak := 1;
  elsif p_day = last_day + 1 then
    streak := streak + 1;
  else
    return; -- same day or a back-filled older day: streak unchanged
  end if;
  update public.keeper_stats
     set current_streak = streak,
         longest_streak = greatest(longest_streak, streak),
         last_active_date = p_day
   where user_id = p_user;
end
$$;

create or replace function private.evaluate_achievements(p_user uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  s public.keeper_stats%rowtype;
  a record;
  restored integer;
  progress integer;
  unlocked jsonb := '[]'::jsonb;
  changed boolean;
  rounds integer := 0;
begin
  loop
    changed := false;
    perform private.sync_world(p_user);
    select * into s from public.keeper_stats where user_id = p_user;
    select count(*) into restored from public.world_progress where user_id = p_user and state = 'restored';
    for a in
      select * from public.achievements ach
       where not exists (select 1 from public.user_achievements ua
                          where ua.user_id = p_user and ua.achievement_id = ach.id)
       order by ach.sort_order
    loop
      progress := case a.criteria_type
        when 'quests_completed' then s.quests_completed
        when 'boss_quests_completed' then s.boss_quests_completed
        when 'rituals_completed' then s.rituals_completed
        when 'streak_days' then s.longest_streak
        when 'focus_sessions' then s.focus_sessions_completed
        when 'focus_minutes' then s.focus_minutes
        when 'soul_energy' then s.soul_energy
        when 'regions_restored' then restored
        when 'level' then s.level
        else 0
      end;
      if progress >= a.criteria_value then
        insert into public.user_achievements (user_id, achievement_id) values (p_user, a.id)
        on conflict do nothing;
        if found then
          perform private.grant_xp(p_user, 'achievement', a.id, 'achievement:' || a.id, a.xp_reward, a.name);
          unlocked := unlocked || jsonb_build_array(jsonb_build_object(
            'id', a.id, 'name', a.name, 'description', a.description,
            'icon', a.icon, 'xp', a.xp_reward, 'cosmetic', a.cosmetic));
          changed := true;
        end if;
      end if;
    end loop;
    rounds := rounds + 1;
    exit when not changed or rounds >= 5;
  end loop;
  perform private.sync_world(p_user);
  return unlocked;
end
$$;

create or replace function private.snapshot(p_user uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'stats', (select to_jsonb(k) - 'user_id' - 'soul_banked' from public.keeper_stats k where k.user_id = p_user),
    'world', coalesce((
      select jsonb_agg(jsonb_build_object(
               'area_id', wp.area_id, 'points', wp.points, 'state', wp.state,
               'required', wa.restore_points, 'unlock_level', wa.unlock_level,
               'unlocked_at', wp.unlocked_at, 'restored_at', wp.restored_at)
             order by wa.sort_order)
        from public.world_progress wp
        join public.world_areas wa on wa.id = wp.area_id
       where wp.user_id = p_user), '[]'::jsonb),
    'achievements', coalesce((
      select jsonb_agg(jsonb_build_object('id', ua.achievement_id, 'unlocked_at', ua.unlocked_at))
        from public.user_achievements ua where ua.user_id = p_user), '[]'::jsonb)
  )
$$;

create or replace function private.reward_result(
  p_user uuid, p_xp integer, p_level_before integer, p_unlocked jsonb, p_extra jsonb
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  snap jsonb := private.snapshot(p_user);
  lvl integer := (snap -> 'stats' ->> 'level')::integer;
begin
  return jsonb_build_object(
    'ok', true,
    'xp_awarded', p_xp,
    'level_before', p_level_before,
    'level_after', lvl,
    'level_up', lvl > p_level_before,
    'unlocked_achievements', coalesce(p_unlocked, '[]'::jsonb),
    'snapshot', snap
  ) || coalesce(p_extra, '{}'::jsonb);
end
$$;

create or replace function private.reject(p_op uuid, p_error text) returns jsonb
language sql security definer set search_path = '' as $$
  select private.finish_op(p_op, 'rejected', jsonb_build_object('ok', false, 'error', p_error))
$$;

-- ---------------------------------------------------------------------------
-- Public RPCs
-- ---------------------------------------------------------------------------
create or replace function public.complete_quest(
  p_op_id uuid, p_quest_id uuid, p_completed_at timestamptz default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_user();
  tz text := private.user_tz(uid);
  dup jsonb;
  q public.quests%rowtype;
  done_at timestamptz;
  local_day date;
  day_start timestamptz;
  period text;
  xp integer;
  awarded integer;
  capped boolean := false;
  rewarded_today integer;
  same_tier_today integer;
  lvl_before integer;
  unlocked jsonb;
begin
  dup := private.claim_op(p_op_id, uid, 'quest.complete', p_quest_id,
                          jsonb_build_object('completed_at', p_completed_at), p_completed_at);
  if dup is not null then
    return dup;
  end if;

  select k.level into lvl_before from public.keeper_stats k where k.user_id = uid for update;

  select * into q from public.quests
   where id = p_quest_id and user_id = uid and deleted_at is null
   for update;
  if not found then
    return private.reject(p_op_id, 'quest_not_found');
  end if;
  if q.status = 'archived' then
    return private.reject(p_op_id, 'quest_archived');
  end if;
  if q.recurrence = 'none' and q.status = 'completed' then
    return private.reject(p_op_id, 'already_completed');
  end if;

  -- Offline completions keep their timestamp, bounded to the last 3 days.
  done_at := least(greatest(coalesce(p_completed_at, now()), now() - interval '3 days'), now());
  local_day := (done_at at time zone tz)::date;
  day_start := local_day::timestamp at time zone tz;
  period := case q.recurrence
    when 'daily' then to_char(local_day, 'YYYY-MM-DD')
    when 'weekly' then to_char(local_day, 'IYYY-"W"IW')
    else 'once'
  end;

  -- Anti-farming caps per local day.
  xp := private.quest_xp(q.difficulty);
  select count(*) into rewarded_today from public.quest_history h
   where h.user_id = uid and h.completed_at >= day_start and h.completed_at < day_start + interval '1 day'
     and h.xp_awarded > 0;
  select count(*) into same_tier_today from public.quest_history h
   where h.user_id = uid and h.completed_at >= day_start and h.completed_at < day_start + interval '1 day'
     and h.xp_awarded > 0 and h.difficulty = q.difficulty;
  if rewarded_today >= 25
     or (q.difficulty = 'boss' and same_tier_today >= 3)
     or (q.difficulty = 'hard' and same_tier_today >= 8) then
    xp := 0;
    capped := true;
  end if;

  insert into public.quest_history (user_id, quest_id, period_key, difficulty, xp_awarded, completed_at)
  values (uid, q.id, period, q.difficulty, xp, done_at)
  on conflict (quest_id, period_key) do nothing;
  if not found then
    return private.reject(p_op_id, 'already_completed_this_period');
  end if;

  awarded := private.grant_xp(uid, 'quest', q.id::text, 'quest:' || q.id || ':' || period, xp, q.title);
  update public.quest_history set xp_awarded = awarded where quest_id = q.id and period_key = period;

  perform set_config('graveyard.trusted', 'on', true);
  update public.quests
     set status = case when recurrence = 'none' then 'completed' else 'active' end,
         completed_at = done_at,
         last_completed_period = period,
         deadline = case
           when recurrence = 'daily' and deadline is not null then deadline + make_interval(
             days => greatest(1, floor(extract(epoch from (now() - deadline)) / 86400)::integer + 1))
           when recurrence = 'weekly' and deadline is not null then deadline + make_interval(
             days => 7 * greatest(1, floor(extract(epoch from (now() - deadline)) / 604800)::integer + 1))
           else deadline
         end,
         updated_at = now()
   where id = q.id;
  perform set_config('graveyard.trusted', 'off', true);

  update public.keeper_stats
     set quests_completed = quests_completed + 1,
         boss_quests_completed = boss_quests_completed + (q.difficulty = 'boss')::integer
   where user_id = uid;
  perform private.touch_activity(uid, local_day);
  unlocked := private.evaluate_achievements(uid);

  return private.finish_op(p_op_id, 'applied', private.reward_result(uid, awarded, lvl_before, unlocked,
    jsonb_build_object('quest_id', q.id, 'period_key', period, 'capped', capped,
                       'quest', (select to_jsonb(x) from public.quests x where x.id = q.id))));
end
$$;

create or replace function public.complete_ritual(
  p_op_id uuid, p_ritual_id uuid, p_date date default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_user();
  tz text := private.user_tz(uid);
  dup jsonb;
  r public.rituals%rowtype;
  today date;
  d date;
  week_count integer;
  awarded integer;
  lvl_before integer;
  unlocked jsonb;
begin
  dup := private.claim_op(p_op_id, uid, 'ritual.complete', p_ritual_id,
                          jsonb_build_object('date', p_date), null);
  if dup is not null then
    return dup;
  end if;

  select k.level into lvl_before from public.keeper_stats k where k.user_id = uid for update;

  today := (now() at time zone tz)::date;
  d := coalesce(p_date, today);
  if d > today or d < today - 2 then
    return private.reject(p_op_id, 'date_out_of_range');
  end if;

  select * into r from public.rituals
   where id = p_ritual_id and user_id = uid and deleted_at is null and not is_archived;
  if not found then
    return private.reject(p_op_id, 'ritual_not_found');
  end if;
  if r.schedule_type = 'custom' and not (extract(dow from d)::smallint = any (r.schedule_days)) then
    return private.reject(p_op_id, 'not_scheduled_today');
  end if;
  if r.schedule_type = 'weekly' then
    select count(*) into week_count from public.ritual_completions c
     where c.ritual_id = r.id and date_trunc('week', c.completion_date) = date_trunc('week', d);
    if week_count >= r.weekly_target then
      return private.reject(p_op_id, 'weekly_target_reached');
    end if;
  end if;

  insert into public.ritual_completions (user_id, ritual_id, completion_date)
  values (uid, r.id, d)
  on conflict (ritual_id, completion_date) do nothing;
  if not found then
    return private.reject(p_op_id, 'already_completed');
  end if;

  awarded := private.grant_xp(uid, 'ritual', r.id::text, 'ritual:' || r.id || ':' || d, 15, r.title);
  update public.ritual_completions set xp_awarded = awarded where ritual_id = r.id and completion_date = d;
  update public.keeper_stats set rituals_completed = rituals_completed + 1 where user_id = uid;
  perform private.touch_activity(uid, d);
  unlocked := private.evaluate_achievements(uid);

  return private.finish_op(p_op_id, 'applied', private.reward_result(uid, awarded, lvl_before, unlocked,
    jsonb_build_object('ritual_id', r.id, 'completion_date', d)));
end
$$;

create or replace function public.record_focus_session(
  p_op_id uuid,
  p_session_id uuid,
  p_kind text,
  p_planned_minutes integer,
  p_actual_minutes integer,
  p_started_at timestamptz,
  p_ended_at timestamptz,
  p_quest_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_user();
  tz text := private.user_tz(uid);
  dup jsonb;
  is_focus boolean := p_kind in ('pomodoro', 'custom');
  quest uuid := null;
  day_start timestamptz;
  minutes_today integer;
  rewardable integer;
  xp integer := 0;
  awarded integer;
  lvl_before integer;
  unlocked jsonb;
  finished boolean;
begin
  dup := private.claim_op(p_op_id, uid, 'focus.record', p_session_id,
    jsonb_build_object('kind', p_kind, 'planned', p_planned_minutes, 'actual', p_actual_minutes,
                       'started_at', p_started_at, 'ended_at', p_ended_at), p_ended_at);
  if dup is not null then
    return dup;
  end if;

  select k.level into lvl_before from public.keeper_stats k where k.user_id = uid for update;

  if p_kind is null or p_kind not in ('pomodoro', 'custom', 'short_break', 'long_break') then
    return private.reject(p_op_id, 'invalid_kind');
  end if;
  if p_planned_minutes is null or p_planned_minutes not between 1 and 180
     or p_actual_minutes is null or p_actual_minutes not between 0 and p_planned_minutes then
    return private.reject(p_op_id, 'invalid_duration');
  end if;
  if p_started_at is null or p_ended_at is null or p_ended_at < p_started_at
     or p_ended_at > now() + interval '2 minutes' or p_started_at < now() - interval '3 days' then
    return private.reject(p_op_id, 'invalid_time_range');
  end if;
  -- Wall-clock time must cover the claimed focus minutes (90s tolerance).
  if extract(epoch from (p_ended_at - p_started_at)) < p_actual_minutes * 60 - 90 then
    return private.reject(p_op_id, 'duration_exceeds_elapsed_time');
  end if;
  if is_focus and exists (
    select 1 from public.focus_sessions f
     where f.user_id = uid and f.kind in ('pomodoro', 'custom')
       and f.started_at < p_ended_at and f.ended_at > p_started_at) then
    return private.reject(p_op_id, 'overlapping_session');
  end if;
  if p_quest_id is not null then
    select id into quest from public.quests where id = p_quest_id and user_id = uid;
  end if;

  finished := p_actual_minutes >= p_planned_minutes;
  insert into public.focus_sessions (id, user_id, kind, planned_minutes, actual_minutes,
                                     started_at, ended_at, completed, quest_id)
  values (p_session_id, uid, p_kind, p_planned_minutes, p_actual_minutes,
          p_started_at, p_ended_at, finished, quest)
  on conflict (id) do nothing;
  if not found then
    return private.reject(p_op_id, 'duplicate_session');
  end if;

  if is_focus and p_actual_minutes >= 5 then
    day_start := ((p_started_at at time zone tz)::date)::timestamp at time zone tz;
    select coalesce(sum(f.actual_minutes), 0) into minutes_today from public.focus_sessions f
     where f.user_id = uid and f.kind in ('pomodoro', 'custom') and f.id <> p_session_id
       and f.started_at >= day_start and f.started_at < day_start + interval '1 day';
    rewardable := least(p_actual_minutes, 60, greatest(0, 240 - minutes_today));
    xp := (rewardable / 5) * 5;
  end if;

  awarded := private.grant_xp(uid, 'focus', p_session_id::text, 'focus:' || p_session_id, xp, p_kind);
  update public.focus_sessions set xp_awarded = awarded where id = p_session_id;

  if is_focus then
    update public.keeper_stats
       set focus_minutes = focus_minutes + p_actual_minutes,
           focus_sessions_completed = focus_sessions_completed + (finished and p_actual_minutes >= 5)::integer
     where user_id = uid;
    if p_actual_minutes >= 5 then
      perform private.touch_activity(uid, (p_started_at at time zone tz)::date);
    end if;
  end if;
  unlocked := private.evaluate_achievements(uid);

  return private.finish_op(p_op_id, 'applied', private.reward_result(uid, awarded, lvl_before, unlocked,
    jsonb_build_object('session_id', p_session_id)));
end
$$;

create or replace function public.get_keeper_snapshot() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  return private.snapshot(private.require_user());
end
$$;

-- AI proposals become real quests/rituals only after explicit user approval.
create or replace function public.decide_ai_proposal(p_proposal_id uuid, p_approve boolean)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_user();
  p public.ai_proposals%rowtype;
  title text;
  descr text;
  difficulty text;
  priority text;
  days integer;
  category uuid;
  schedule text;
  new_id uuid;
  entity jsonb;
begin
  select * into p from public.ai_proposals where id = p_proposal_id and user_id = uid for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'proposal_not_found');
  end if;
  if p.status <> 'pending' then
    return jsonb_build_object('ok', false, 'error', 'proposal_already_decided', 'status', p.status);
  end if;
  if not coalesce(p_approve, false) then
    update public.ai_proposals set status = 'rejected', decided_at = now() where id = p.id;
    return jsonb_build_object('ok', true, 'status', 'rejected');
  end if;

  title := left(btrim(coalesce(p.payload ->> 'title', '')), case when p.kind = 'quest' then 120 else 80 end);
  descr := left(coalesce(p.payload ->> 'description', ''), case when p.kind = 'quest' then 1000 else 500 end);
  if title = '' then
    return jsonb_build_object('ok', false, 'error', 'invalid_proposal');
  end if;

  perform set_config('graveyard.trusted', 'on', true);
  if p.kind = 'quest' then
    difficulty := coalesce(nullif(p.payload ->> 'difficulty', ''), 'medium');
    if difficulty not in ('easy', 'medium', 'hard', 'boss') then difficulty := 'medium'; end if;
    priority := coalesce(nullif(p.payload ->> 'priority', ''), 'medium');
    if priority not in ('low', 'medium', 'high', 'urgent') then priority := 'medium'; end if;
    days := case when (p.payload ->> 'deadline_days') ~ '^\d{1,3}$'
                 then least((p.payload ->> 'deadline_days')::integer, 365) end;
    select c.id into category from public.quest_categories c
     where c.user_id is null and lower(c.name) = lower(coalesce(p.payload ->> 'category', ''))
     limit 1;
    insert into public.quests (user_id, title, description, category_id, priority, difficulty, deadline, source)
    values (uid, title, descr, category, priority, difficulty,
            case when days is not null then now() + make_interval(days => days) end, 'ai')
    returning id into new_id;
    select to_jsonb(x) into entity from public.quests x where x.id = new_id;
  else
    schedule := coalesce(nullif(p.payload ->> 'schedule_type', ''), 'daily');
    if schedule not in ('daily', 'weekly') then schedule := 'daily'; end if;
    insert into public.rituals (user_id, title, description, schedule_type)
    values (uid, title, descr, schedule)
    returning id into new_id;
    select to_jsonb(x) into entity from public.rituals x where x.id = new_id;
  end if;
  perform set_config('graveyard.trusted', 'off', true);

  update public.ai_proposals
     set status = 'approved', decided_at = now(), created_entity_id = new_id
   where id = p.id;
  return jsonb_build_object('ok', true, 'status', 'approved', 'kind', p.kind, 'entity', entity);
end
$$;

-- ---------------------------------------------------------------------------
-- New keeper bootstrap
-- ---------------------------------------------------------------------------
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  name text := nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 40), '');
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(name, nullif(left(split_part(coalesce(new.email, ''), '@', 1), 40), ''), 'Keeper'));
  insert into public.keeper_stats (user_id) values (new.id);
  insert into public.user_settings (user_id) values (new.id);
  insert into public.notification_preferences (user_id) values (new.id);
  insert into public.world_progress (user_id, area_id, state, unlocked_at)
  select new.id, wa.id,
         case when wa.unlock_level <= 1 then 'abandoned' else 'locked' end,
         case when wa.unlock_level <= 1 then now() end
    from public.world_areas wa;
  return new;
end
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------
revoke all on all functions in schema private from public, anon, authenticated;
revoke all on function public.complete_quest(uuid, uuid, timestamptz) from public, anon;
revoke all on function public.complete_ritual(uuid, uuid, date) from public, anon;
revoke all on function public.record_focus_session(uuid, uuid, text, integer, integer, timestamptz, timestamptz, uuid) from public, anon;
revoke all on function public.get_keeper_snapshot() from public, anon;
revoke all on function public.decide_ai_proposal(uuid, boolean) from public, anon;
grant execute on function public.complete_quest(uuid, uuid, timestamptz) to authenticated;
grant execute on function public.complete_ritual(uuid, uuid, date) to authenticated;
grant execute on function public.record_focus_session(uuid, uuid, text, integer, integer, timestamptz, timestamptz, uuid) to authenticated;
grant execute on function public.get_keeper_snapshot() to authenticated;
grant execute on function public.decide_ai_proposal(uuid, boolean) to authenticated;
