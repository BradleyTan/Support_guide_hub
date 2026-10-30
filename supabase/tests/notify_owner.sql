-- Checks the owner sign-up email wiring (migration 0015). Rolls back; returns 'notify_owner: all checks passed'.
begin;
set local role authenticated;
do $$ begin perform public.notify_owner_secret_ok('guess'); raise exception 'signed-in users can test the notify secret'; exception when insufficient_privilege then null; end $$;
reset role;
set local role anon;
do $$ begin perform public.notify_owner_secret_ok('guess'); raise exception 'anon can test the notify secret'; exception when insufficient_privilege then null; end $$;
reset role;
set local role service_role;
do $$ begin
  if public.notify_owner_secret_ok('guess') then raise exception 'a wrong secret was accepted'; end if;
  if public.notify_owner_secret_ok('') then raise exception 'an empty secret was accepted'; end if;
end $$;
reset role;
do $$
declare
  v_user uuid := gen_random_uuid();
  v_before bigint;
  v_req record;
begin
  if (select count(*) from vault.secrets where name = 'notify_owner_secret') <> 1 then raise exception 'expected exactly one notify secret'; end if;

  -- A new pending member queues exactly one call carrying the secret and only the user id.
  select coalesce(max(id), 0) into v_before from net.http_request_queue;
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values (v_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'notify-test@example.com', '{}'::jsonb, now(), now());
  insert into public.team_members (user_id, email, display_name) values (v_user, 'notify-test@example.com', 'Notify Test');
  select * into v_req from net.http_request_queue where id > v_before and url like '%/functions/v1/notify-owner';
  if v_req is null then raise exception 'no notify-owner request was queued'; end if;
  if (select count(*) from net.http_request_queue where id > v_before and url like '%/functions/v1/notify-owner') <> 1 then raise exception 'expected exactly one notify-owner request'; end if;
  if v_req.method <> 'POST' then raise exception 'notify-owner request is not a POST'; end if;
  if not public.notify_owner_secret_ok(v_req.headers ->> 'x-notify-secret') then raise exception 'notify-owner request lacks the secret'; end if;
  if convert_from(v_req.body, 'utf8')::jsonb <> jsonb_build_object('user_id', v_user) then raise exception 'notify-owner body should be only the user id'; end if;

  -- The real path: a confirmed sign-up becomes a pending member (0014), which queues the email.
  select coalesce(max(id), 0) into v_before from net.http_request_queue;
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
  values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'notify-test3@example.com', now(), '{"display_name":"Notify Three"}'::jsonb, now(), now());
  if (select count(*) from net.http_request_queue where id > v_before and url like '%/functions/v1/notify-owner') <> 1 then raise exception 'a confirmed sign-up did not queue one email'; end if;

  -- An approved row (e.g. the owner seed) queues nothing.
  update public.team_members set status = 'approved' where user_id = v_user;
  select coalesce(max(id), 0) into v_before from net.http_request_queue;
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'notify-test2@example.com', '{}'::jsonb, now(), now())
  returning id into v_user;
  insert into public.team_members (user_id, email, status) values (v_user, 'notify-test2@example.com', 'approved');
  if exists (select 1 from net.http_request_queue where id > v_before and url like '%/functions/v1/notify-owner') then raise exception 'an approved row queued an email'; end if;
end $$;
select 'notify_owner: all checks passed' as result;
rollback;
