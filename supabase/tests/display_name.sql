-- set_my_display_name(): an approved member changes only their own name; bad names and outsiders are refused.
begin;

do $$
begin
  if has_function_privilege('anon', 'public.set_my_display_name(text)', 'execute') then
    raise exception 'anon must not execute set_my_display_name';
  end if;
end $$;

-- The test member renames themselves; the owner's name is untouched.
set local role authenticated;
set local request.jwt.claims to '{"sub":"b1e2ff14-a47f-486b-a43a-26635994a67e","role":"authenticated"}';
do $$
begin
  if public.set_my_display_name('  Test Person  ') <> 'Test Person' then
    raise exception 'name should be trimmed';
  end if;
  begin
    perform public.set_my_display_name('   ');
    raise exception 'blank name should be refused';
  exception when check_violation then null;
  end;
  begin
    perform public.set_my_display_name(repeat('x', 81));
    raise exception '81 characters should be refused';
  exception when check_violation then null;
  end;
end $$;
reset role;

do $$
begin
  if (select display_name from public.team_members where user_id = 'b1e2ff14-a47f-486b-a43a-26635994a67e') <> 'Test Person' then
    raise exception 'member name not saved';
  end if;
  if (select display_name from public.team_members where role = 'owner') = 'Test Person' then
    raise exception 'owner name must not change';
  end if;
end $$;

-- A removed member can't rename themselves.
update public.team_members set status = 'removed' where user_id = 'b1e2ff14-a47f-486b-a43a-26635994a67e';
set local role authenticated;
do $$
begin
  begin
    perform public.set_my_display_name('Sneaky');
    raise exception 'removed member should be refused';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select 'display_name: all checks passed' as result;
rollback;
