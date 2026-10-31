-- Editor names for "Last edited by" and edit history. Members can read only their own team_members row, so this
-- returns just the display names (never emails) of the people asked for, and nothing to anyone who isn't approved.
create or replace function public.team_member_names(p_ids uuid[])
returns table (user_id uuid, display_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select t.user_id, t.display_name
  from public.team_members t
  where public.is_member() and t.user_id = any (p_ids);
$$;

revoke execute on function public.team_member_names(uuid[]) from public, anon;
grant execute on function public.team_member_names(uuid[]) to authenticated;
