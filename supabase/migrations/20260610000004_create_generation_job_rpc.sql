-- Migration: 0009 — atomic job creation RPC
-- Source of truth: docs/04-data-model.md §创建任务（原子化 · Postgres RPC）
-- supabase-js (PostgREST) has no multi-statement transactions: quota check +
-- balance debit + job insert MUST be one function or concurrent requests double-spend.
-- FOR UPDATE row locks serialize same-user concurrency.

create or replace function public.create_generation_job(
  p_user_id     uuid,
  p_template_id uuid,
  p_keyword     text,
  p_provider    text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  c_daily_limit constant int := 10;  -- docs/01: 每用户每天 10 次
  v_template record;
  v_model    record;
  v_quota    int;
  v_balance  int;
  v_job_id   uuid;
begin
  select id, model_id, recommended_width, recommended_height, credits_cost, is_active
    into v_template
    from templates where id = p_template_id;
  if not found or not v_template.is_active then
    raise exception 'template_not_found';
  end if;

  select id, type into v_model from models where id = v_template.model_id;
  if not found then
    raise exception 'template_not_found';
  end if;

  -- Ensure the quota row exists, then lock it (serializes per user/day).
  insert into daily_quota (user_id, day, count)
  values (p_user_id, current_date, 0)
  on conflict (user_id, day) do nothing;

  select count into v_quota
    from daily_quota
   where user_id = p_user_id and day = current_date
   for update;
  if v_quota >= c_daily_limit then
    raise exception 'quota_exceeded';
  end if;

  select credits_balance into v_balance
    from profiles where id = p_user_id
   for update;
  if v_balance is null then
    raise exception 'profile_not_found';
  end if;
  if v_balance < v_template.credits_cost then
    raise exception 'insufficient_credits';
  end if;

  insert into generation_jobs (user_id, type, status, template_id, provider, model, input, credits_cost)
  values (
    p_user_id, v_model.type, 'pending', v_template.id, p_provider, v_model.id,
    jsonb_build_object(
      'keyword', p_keyword,
      'width', v_template.recommended_width,
      'height', v_template.recommended_height
    ),
    v_template.credits_cost
  )
  returning id into v_job_id;

  insert into credit_ledger (user_id, delta, reason, ref_job_id)
  values (p_user_id, -v_template.credits_cost, 'generation_charge', v_job_id);
  -- credit_ledger_sync_balance trigger updates profiles.credits_balance.

  update daily_quota set count = count + 1
   where user_id = p_user_id and day = current_date;

  return v_job_id;
end;
$$;

-- service_role only — the API layer authenticates the user and passes p_user_id.
revoke execute on function public.create_generation_job(uuid, uuid, text, text) from public;
revoke execute on function public.create_generation_job(uuid, uuid, text, text) from anon;
revoke execute on function public.create_generation_job(uuid, uuid, text, text) from authenticated;
