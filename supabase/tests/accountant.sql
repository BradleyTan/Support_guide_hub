-- Checks migration 0012: guide platform backfill, chat RLS and search. Rolls back; returns 'accountant: all checks passed'.
begin;
insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-a@test.invalid'),
  ('00000000-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-b@test.invalid');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);

-- New guides default to desktop; only the three platforms are allowed. (The backfill itself is checked once,
-- against real data, right after the migration is applied.)
insert into public.guides (title, product, steps) values ('Desktop guide', 'AutoCount Accounting', '{"Open A/R"}');
do $$
declare n int;
begin
  select count(*) into n from public.guides where title = 'Desktop guide' and platform = 'desktop'; if n <> 1 then raise exception 'new guide is not desktop by default'; end if;
  begin
    update public.guides set platform = 'mobile' where title = 'Desktop guide';
    raise exception 'unknown platform accepted';
  exception when check_violation then null;
  end;
end $$;

insert into public.accountant_chats (id, title) values ('00000000-0000-4000-8000-0000000000c1', 'Old deposit never recorded');
insert into public.accountant_messages (chat_id, role, content) values
  ('00000000-0000-4000-8000-0000000000c1', 'user', 'Customer paid a deposit two years ago and wants to knock off last month''s invoice');
insert into public.accountant_messages (chat_id, role, content, answer) values
  ('00000000-0000-4000-8000-0000000000c1', 'assistant', '', '{"answer":{"summary":"Find where the money went first"},"customerReply":null}');
do $$
declare n int;
begin
  select count(*) into n from public.search_accountant_chats('knock off invoice'); if n <> 1 then raise exception 'message text not searchable, got %', n; end if;
  select count(*) into n from public.search_accountant_chats('money went'); if n <> 1 then raise exception 'answer summary not searchable'; end if;
  select count(*) into n from public.search_accountant_chats('deposit nevr recorded'); if n < 1 then raise exception 'title typo search found nothing'; end if;
  perform public.search_accountant_chats(''''); perform public.search_accountant_chats('%'); perform public.search_accountant_chats(''); perform public.search_accountant_chats('a');
  update public.accountant_chats set deleted_at = now();
  select count(*) into n from public.search_accountant_chats('deposit'); if n <> 0 then raise exception 'search found a binned chat'; end if;
  update public.accountant_chats set deleted_at = null;
  begin
    insert into public.user_settings (chat_model) values ('bad model; drop table');
    raise exception 'bad model name accepted';
  exception when check_violation then null;
  end;
end $$;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
do $$
declare n int;
begin
  select count(*) into n from public.accountant_chats; if n <> 0 then raise exception 'B sees A chats'; end if;
  select count(*) into n from public.accountant_messages; if n <> 0 then raise exception 'B sees A messages'; end if;
  select count(*) into n from public.search_accountant_chats('deposit'); if n <> 0 then raise exception 'B finds A chats in search'; end if;
  update public.accountant_chats set title = 'hacked';
  update public.accountant_messages set checked = true;
  delete from public.accountant_messages;
  delete from public.accountant_chats;
  begin
    insert into public.accountant_messages (chat_id, role, content) values ('00000000-0000-4000-8000-0000000000c1', 'user', 'B writes into A''s chat');
    raise exception 'B added a message to A''s chat';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.accountant_chats (user_id, title) values ('00000000-0000-4000-8000-00000000000a', 'Spoof');
    raise exception 'B created a chat as A';
  exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
do $$
declare n int;
begin
  select count(*) into n from public.accountant_chats where title = 'Old deposit never recorded'; if n <> 1 then raise exception 'B changed A chat'; end if;
  select count(*) into n from public.accountant_messages where not checked; if n <> 2 then raise exception 'B changed or deleted A messages'; end if;
end $$;
reset role;
set local role anon;
do $$ begin perform public.search_accountant_chats('deposit'); raise exception 'anon can search chats'; exception when insufficient_privilege then null; end $$;
do $$ declare n int; begin
  select count(*) into n from public.accountant_chats; if n <> 0 then raise exception 'anon sees chats'; end if;
exception when insufficient_privilege then null;
end $$;
select 'accountant: all checks passed' as result;
rollback;
