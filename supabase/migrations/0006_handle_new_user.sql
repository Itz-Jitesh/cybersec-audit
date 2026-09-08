-- 0006_handle_new_user.sql
-- Invite gating, enforced in the database rather than in the application.
--
-- Supabase creates the auth.users row the instant an OAuth provider returns a
-- verified identity, before any application code runs. Checking the invite in a
-- route handler would therefore leave a real account behind for anyone who
-- completed a Google consent screen. Raising here aborts the insert in the same
-- transaction, so an uninvited sign-in leaves nothing at all.
--
-- The function is SECURITY DEFINER because it writes to public tables whose RLS
-- policies expect an authenticated session, and there is no session yet at the
-- moment it runs.

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  matched invites%rowtype;
  resolved_name text;
begin
  select * into matched
    from invites
   where lower(email::text) = lower(new.email)
     and accepted_at is null
     and expires_at > now()
   order by created_at desc
   limit 1;

  if matched.id is null then
    -- The callback route matches on this exact string to show the rejection
    -- screen rather than a generic failure.
    raise exception 'NO_INVITE';
  end if;

  resolved_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(new.email, '@', 1)
  );

  insert into profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    resolved_name,
    nullif(trim(new.raw_user_meta_data ->> 'avatar_url'), '')
  );

  insert into workspace_members (user_id, role, is_active)
  values (new.id, matched.role, true);

  if matched.team_id is not null then
    insert into team_members (team_id, user_id, role)
    values (matched.team_id, new.id, coalesce(matched.team_role, 'member'));
  end if;

  update invites set accepted_at = now() where id = matched.id;

  return new;
end;
$$;

drop trigger if exists handle_new_user on auth.users;
create trigger handle_new_user
  after insert on auth.users
  for each row execute function handle_new_user();
