-- team_member_names(): approved members get display names for the ids they ask for; nobody else gets anything.
begin;

-- No email column is exposed, and anon cannot call it.
do $$
begin
  if (select 'email' = any (proargnames) from pg_proc where oid = 'public.team_member_names(uuid[])'::regprocedure) then
    raise exception 'team_member_names must not return email';
  end if;
  if has_function_privilege('anon', 'public.team_member_names(uuid[])', 'execute') then
    raise exception 'anon must not execute team_member_names';
  end if;
end $$;

-- An approved member sees the owner's name, and only for the ids asked for.
set local role authenticated;
set local request.jwt.claims to '{"sub":"b1e2ff14-a47f-486b-a43a-26635994a67e","role":"authenticated"}';
do $$
begin
  if (select count(*) from public.team_member_names(array['0e19c3dd-c912-4d00-b702-48b8b2e01869'::uuid])) <> 1 then
    raise exception 'member should get the owner''s name';
  end if;
  if (select count(*) from public.team_member_names(array[gen_random_uuid()])) <> 0 then
    raise exception 'unknown id should return nothing';
  end if;
end $$;
reset role;

-- A removed member gets nothing.
update public.team_members set status = 'removed' where user_id = 'b1e2ff14-a47f-486b-a43a-26635994a67e';
set local role authenticated;
do $$
begin
  if (select count(*) from public.team_member_names(array['0e19c3dd-c912-4d00-b702-48b8b2e01869'::uuid])) <> 0 then
    raise exception 'removed member should get no names';
  end if;
end $$;
reset role;

select 'team_names: all checks passed' as result;
rollback;
