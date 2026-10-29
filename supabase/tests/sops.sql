-- Checks the sops table (migration 0008) under the team rules (0014) and its limits: A is the owner, B is pending.
-- The team library holds real SOPs, so counts are scoped to A's rows. Rolls back; returns 'sops: all checks passed'.
begin;
insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-a@test.invalid'),
  ('00000000-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-b@test.invalid');
delete from public.team_members where role = 'owner';
insert into public.team_members (user_id, email, role, status) values
  ('00000000-0000-4000-8000-00000000000a', 'rls-a@test.invalid', 'owner', 'approved'),
  ('00000000-0000-4000-8000-00000000000b', 'rls-b@test.invalid', 'member', 'pending');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
insert into public.guides (id, title, product) values ('00000000-0000-4000-8000-0000000000a1', 'A guide', 'AutoCount Accounting');
select set_config('test.g', '00000000-0000-4000-8000-0000000000a1', true);
do $$
declare c text; n int;
begin
  insert into public.sops (guide_id, title, steps) values (current_setting('test.g')::uuid, 'SOP: A guide', '[{"text":"Step one","attachmentId":null}]')
    returning code into c;
  if c not like 'SOP-%' then raise exception 'expected SOP code, got %', c; end if;
  insert into public.sops (title) values ('Plain SOP');
  select count(*) into n from public.sops where user_id = '00000000-0000-4000-8000-00000000000a'; if n <> 2 then raise exception 'A should see 2 SOPs, got %', n; end if;
  begin
    insert into public.sops (title, steps) values ('Bad steps', '{"text":"not an array"}');
    raise exception 'steps must be an array';
  exception when check_violation then null;
  end;
  begin
    insert into public.sops (title) values ('   ');
    raise exception 'blank title accepted';
  exception when check_violation then null;
  end;
end $$;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
do $$
declare n int;
begin
  select count(*) into n from public.sops; if n <> 0 then raise exception 'pending B sees SOPs'; end if;
  update public.sops set title = 'hacked'; get diagnostics n = row_count; if n <> 0 then raise exception 'pending B edited SOPs'; end if;
  delete from public.sops;                 get diagnostics n = row_count; if n <> 0 then raise exception 'pending B deleted SOPs'; end if;
  begin
    insert into public.sops (title, guide_id) values ('Link to A guide', current_setting('test.g')::uuid);
    raise exception 'B linked an SOP to A guide';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.sops (user_id, title) values ('00000000-0000-4000-8000-00000000000a', 'Spoof');
    raise exception 'B wrote an SOP as A';
  exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
do $$
declare n int;
begin
  select count(*) into n from public.sops where user_id = '00000000-0000-4000-8000-00000000000a' and title in ('SOP: A guide', 'Plain SOP'); if n <> 2 then raise exception 'B changed A SOPs'; end if;
end $$;
-- Deleting the guide for good (the owner's power) keeps the SOP, unlinked.
delete from public.guides where id = current_setting('test.g')::uuid;
do $$
declare g uuid;
begin
  select guide_id into g from public.sops where title = 'SOP: A guide' and user_id = '00000000-0000-4000-8000-00000000000a';
  if g is not null then raise exception 'SOP still linked to a deleted guide'; end if;
end $$;
reset role;
set local role anon;
do $$ declare n int; begin
  select count(*) into n from public.sops; if n <> 0 then raise exception 'anon sees SOPs'; end if;
exception when insufficient_privilege then null; -- no access at all is fine too
end $$;
select 'sops: all checks passed' as result;
rollback;
