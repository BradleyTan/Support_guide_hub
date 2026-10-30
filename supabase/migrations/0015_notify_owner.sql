-- Team sharing: email the owner when someone signs up and is waiting for approval.
-- A new pending row in team_members queues a call (pg_net) to the notify-owner Edge Function, which reads the
-- names with the service role and sends one email. Same shared-secret pattern as 0009_purge_bin.sql: the secret
-- is generated here, kept in Vault, and sent as a header; the function rejects calls without it.
-- Sign-up never waits for or depends on the email: the request is queued, and any error here is only a warning.

-- A random secret, created inside the database; it never appears in code or logs.
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'notify_owner_secret', 'Shared secret: team_members trigger → notify-owner Edge Function');

-- Lets the Edge Function (service role only) check the secret it received.
create or replace function public.notify_owner_secret_ok(p_secret text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from vault.decrypted_secrets where name = 'notify_owner_secret' and decrypted_secret = p_secret);
$$;
revoke execute on function public.notify_owner_secret_ok(text) from public, anon, authenticated;
grant execute on function public.notify_owner_secret_ok(text) to service_role;

-- Queues the call. Only the user id is sent; the function looks up the name and email itself.
create or replace function public.notify_owner_of_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform net.http_post(
    url := 'https://wslezaavnujedvydjkae.supabase.co/functions/v1/notify-owner',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_DiGuxH2XdthSEQrIMyadVw_Uxo8Sidp',
      'x-notify-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'notify_owner_secret')
    ),
    body := jsonb_build_object('user_id', new.user_id),
    timeout_milliseconds := 30000
  );
  return null;
exception when others then
  raise warning 'notify-owner: request not queued (%)', sqlerrm;
  return null;
end;
$$;
revoke execute on function public.notify_owner_of_signup() from public, anon, authenticated;

create trigger team_members_notify_owner after insert on public.team_members
  for each row when (new.status = 'pending')
  execute function public.notify_owner_of_signup();
