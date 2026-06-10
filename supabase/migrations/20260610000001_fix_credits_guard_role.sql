-- Migration: 0006 — fix profiles_block_credits_update role detection
-- Bug: the trigger read current_setting('request.jwt.claim.role') — a PostgREST
-- legacy GUC that is no longer populated — so it came back NULL for every API
-- request and the trigger blocked service_role balance updates too (verified
-- live: admin client UPDATE credits_balance → exception). auth.jwt() reads the
-- current request.jwt.claims GUC instead.
-- Absent claims (direct SQL: psql / Studio / migrations) are treated as trusted —
-- only API traffic carries a JWT, and that is the surface this guard exists for.

create or replace function public.profiles_block_credits_update()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.jwt() ->> 'role', 'service_role') is distinct from 'service_role'
     and new.credits_balance is distinct from old.credits_balance then
    raise exception 'credits_balance is read-only via API; route through credit_ledger';
  end if;
  return new;
end;
$$;
