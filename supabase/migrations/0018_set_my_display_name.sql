-- Settings → Account → Your name. Members can't update team_members directly (only the owner may change status),
-- so this changes just the caller's own display name, for approved members only.
create or replace function public.set_my_display_name(p_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean text := btrim(coalesce(p_name, ''));
begin
  if not public.is_member() then
    raise exception 'Only approved team members can do this.' using errcode = 'insufficient_privilege';
  end if;
  if length(clean) < 1 or length(clean) > 80 then
    raise exception 'Use 1 to 80 characters for your name.' using errcode = 'check_violation';
  end if;
  update public.team_members set display_name = clean where user_id = (select auth.uid());
  return clean;
end;
$$;

revoke execute on function public.set_my_display_name(text) from public, anon;
grant execute on function public.set_my_display_name(text) to authenticated;
