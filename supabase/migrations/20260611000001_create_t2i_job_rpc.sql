-- Migration: 0010 — atomic text-to-image job creation RPC（创作工作台 · 文生图通路）
-- Mirrors create_generation_job (0009) exactly on quota/debit/ledger semantics;
-- differs only in source of truth: model row (not template) + caller-supplied prompt.
-- The user's own prompt is user content and IS persisted on input (unlike template
-- recipes, which never leave the server — ADR-016 still holds for templates).

create or replace function public.create_t2i_generation_job(
  p_user_id         uuid,
  p_model_id        text,
  p_prompt          text,
  p_negative_prompt text,
  p_seed            bigint,
  p_width           int,
  p_height          int,
  p_provider        text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  c_daily_limit constant int := 10;  -- docs/01: 每用户每天 10 次
  v_model   record;
  v_quota   int;
  v_balance int;
  v_job_id  uuid;
begin
  select id, type, credits_cost, is_active into v_model
    from models where id = p_model_id;
  if not found or not v_model.is_active or v_model.type <> 'text_to_image' then
    raise exception 'model_not_found';
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
  if v_balance < v_model.credits_cost then
    raise exception 'insufficient_credits';
  end if;

  insert into generation_jobs (user_id, type, status, template_id, provider, model, input, credits_cost)
  values (
    p_user_id, v_model.type, 'pending', null, p_provider, v_model.id,
    jsonb_strip_nulls(jsonb_build_object(
      'prompt', p_prompt,
      'negative_prompt', p_negative_prompt,
      'seed', p_seed,
      'width', p_width,
      'height', p_height
    )),
    v_model.credits_cost
  )
  returning id into v_job_id;

  insert into credit_ledger (user_id, delta, reason, ref_job_id)
  values (p_user_id, -v_model.credits_cost, 'generation_charge', v_job_id);
  -- credit_ledger_sync_balance trigger updates profiles.credits_balance.

  update daily_quota set count = count + 1
   where user_id = p_user_id and day = current_date;

  return v_job_id;
end;
$$;

-- service_role only — the API layer authenticates the user and passes p_user_id.
revoke execute on function public.create_t2i_generation_job(uuid, text, text, text, bigint, int, int, text) from public;
revoke execute on function public.create_t2i_generation_job(uuid, text, text, text, bigint, int, int, text) from anon;
revoke execute on function public.create_t2i_generation_job(uuid, text, text, text, bigint, int, int, text) from authenticated;
