-- Signed-in users can read and search the official index but never change it; signed-out visitors see nothing. Rolls back.
begin;
insert into auth.users (id, instance_id, aud, role, email) values ('00000000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-a@test.invalid');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
do $$
declare n int;
begin
  select count(*) into n from public.official_pages; if n = 0 then raise exception 'signed-in user cannot read index'; end if;
  select count(*) into n from public.search_official_pages('invoice'); if n = 0 then raise exception 'search found nothing'; end if;
  update public.official_pages set title = 'hacked'; get diagnostics n = row_count; if n <> 0 then raise exception 'user can edit index'; end if;
  delete from public.official_pages; get diagnostics n = row_count; if n <> 0 then raise exception 'user can delete index'; end if;
  begin insert into public.official_pages (url, site, title) values ('https://evil.example/x', 'x', 'x'); raise exception 'user can insert'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ declare n int; begin select count(*) into n from public.official_pages; if n <> 0 then raise exception 'anon can read index'; end if; end $$;
select 'official_pages: all checks passed' as result;
rollback;
