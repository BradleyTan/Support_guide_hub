-- Phase 7: nightly bin clean-up. Items deleted more than 30 days ago are removed for good by the
-- purge-bin Edge Function (it also deletes guides' files from storage, which SQL can't do).
-- The function only accepts calls carrying a secret that is generated here, kept in Vault, and sent by pg_cron.

-- A random secret, created inside the database; it never appears in code or logs.
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'purge_bin_secret', 'Shared secret: pg_cron → purge-bin Edge Function');

-- Lets the Edge Function (service role only) check the secret it received.
create or replace function public.purge_bin_secret_ok(p_secret text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from vault.decrypted_secrets where name = 'purge_bin_secret' and decrypted_secret = p_secret);
$$;
revoke execute on function public.purge_bin_secret_ok(text) from public, anon, authenticated;
grant execute on function public.purge_bin_secret_ok(text) to service_role;

-- 03:45 Malaysia time (19:45 UTC), after the activity-log clean-up.
select cron.schedule(
  'purge-bin',
  '45 19 * * *',
  $cron$
    select net.http_post(
      url := 'https://wslezaavnujedvydjkae.supabase.co/functions/v1/purge-bin',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', 'sb_publishable_DiGuxH2XdthSEQrIMyadVw_Uxo8Sidp',
        'x-purge-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'purge_bin_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  $cron$
);
