-- Checks the bin clean-up wiring (migration 0009). Rolls back; returns 'purge_bin: all checks passed'.
begin;
set local role authenticated;
do $$ begin perform public.purge_bin_secret_ok('guess'); raise exception 'signed-in users can test the purge secret'; exception when insufficient_privilege then null; end $$;
reset role;
set local role anon;
do $$ begin perform public.purge_bin_secret_ok('guess'); raise exception 'anon can test the purge secret'; exception when insufficient_privilege then null; end $$;
reset role;
set local role service_role;
do $$ begin
  if public.purge_bin_secret_ok('guess') then raise exception 'a wrong secret was accepted'; end if;
  if public.purge_bin_secret_ok('') then raise exception 'an empty secret was accepted'; end if;
end $$;
reset role;
do $$ begin
  if not exists (select 1 from cron.job where jobname = 'purge-bin' and schedule = '45 19 * * *') then raise exception 'purge-bin job missing'; end if;
  if (select count(*) from vault.secrets where name = 'purge_bin_secret') <> 1 then raise exception 'expected exactly one purge secret'; end if;
end $$;
select 'purge_bin: all checks passed' as result;
rollback;
