-- 0012_appeals.sql
-- The appeal workflow: members, leads and mentors ask, a team lead decides.
--
-- Three things live here. The issue_appeals table and its policies; the
-- notification fan-out for an appeal being raised and decided, plus for someone
-- subscribing to an issue; and the gate that stops an issue being marked
-- completed by anyone who is not entitled to inspect it.
--
-- Requires 0011_appeal_enums.sql. Idempotent throughout, so it can be
-- re-applied.

-- ---------------------------------------------------------------------------
-- Who may decide
-- ---------------------------------------------------------------------------
-- The lead of the project's team, with the three workspace admin roles always
-- able to act as well — is_team_lead already folds them in. The fallback is
-- deliberate: a team with no lead must not be a team where nothing can be
-- approved.

create or replace function can_decide_appeal(uid uuid, pid uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from projects p
    where p.id = pid and is_team_lead(uid, p.team_id)
  );
$$;

-- Everyone who should hear about a decision waiting on them.
create or replace function appeal_approvers(pid uuid)
returns setof uuid
language sql stable security definer
set search_path = public, pg_temp
as $$
  select tm.user_id
    from team_members tm
    join projects p on p.id = pid and p.team_id = tm.team_id
   where tm.role = 'lead'
  union
  select wm.user_id
    from workspace_members wm
   where wm.is_active
     and wm.role in ('admin', 'president', 'co_president');
$$;

-- ---------------------------------------------------------------------------
-- The table
-- ---------------------------------------------------------------------------

create table if not exists issue_appeals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  kind appeal_kind not null,
  status appeal_status not null default 'pending',
  issue_id uuid references issues (id) on delete cascade,
  title text,
  description_html text,
  description_json jsonb,
  proposed_priority priority not null default 'none',
  note text,
  requested_by uuid not null references profiles (id) on delete cascade,
  decided_by uuid references profiles (id) on delete set null,
  decided_at timestamptz,
  decision_note text,
  created_issue_id uuid references issues (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint issue_appeals_shape_check check (
    (kind = 'create' and issue_id is null and title is not null)
    or (kind = 'complete' and issue_id is not null)
  ),
  constraint issue_appeals_title_length_check check (
    title is null or char_length(title) <= 500
  ),
  constraint issue_appeals_decision_check check (
    (status = 'pending' and decided_at is null) or status <> 'pending'
  )
);

create index if not exists issue_appeals_project_id_status_idx
  on issue_appeals (project_id, status, created_at desc);
create index if not exists issue_appeals_requested_by_idx
  on issue_appeals (requested_by, created_at desc);
create index if not exists issue_appeals_issue_id_idx
  on issue_appeals (issue_id) where issue_id is not null;

drop trigger if exists set_updated_at on issue_appeals;
create trigger set_updated_at
  before update on issue_appeals
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------
-- Readable by the project, raised only for yourself and only as pending,
-- decided only by someone entitled to decide and never by the requester, and
-- withdrawn only by the requester while it is still pending.

alter table issue_appeals enable row level security;

drop policy if exists issue_appeals_select on issue_appeals;
create policy issue_appeals_select on issue_appeals for select to authenticated
  using (is_project_member(auth.uid(), project_id));

drop policy if exists issue_appeals_insert on issue_appeals;
create policy issue_appeals_insert on issue_appeals for insert to authenticated
  with check (
    is_project_member(auth.uid(), project_id)
    and requested_by = auth.uid()
    and status = 'pending'
    and decided_by is null
    and created_issue_id is null
  );

drop policy if exists issue_appeals_decide on issue_appeals;
create policy issue_appeals_decide on issue_appeals for update to authenticated
  using (
    can_decide_appeal(auth.uid(), project_id)
    and requested_by <> auth.uid()
  )
  with check (
    can_decide_appeal(auth.uid(), project_id)
    and requested_by <> auth.uid()
  );

drop policy if exists issue_appeals_withdraw on issue_appeals;
create policy issue_appeals_withdraw on issue_appeals for delete to authenticated
  using (requested_by = auth.uid() and status = 'pending');

-- ---------------------------------------------------------------------------
-- notify_appeal
-- ---------------------------------------------------------------------------
-- On insert, every approver hears about it. On a status change, the requester
-- hears the answer. The actor is taken from the row rather than from auth.uid(),
-- because server actions reach the database as the table owner and auth.uid() is
-- null on that path — a fan-out that depended on it would write nothing.

create or replace function notify_appeal()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  subject text;
  heading text;
begin
  if tg_op = 'INSERT' then
    if new.kind = 'create' then
      heading := 'Issue requested';
      subject := new.title;
    else
      heading := 'Completion requested';
      select i.name into subject from issues i where i.id = new.issue_id;
    end if;

    insert into notifications (user_id, issue_id, actor_id, type, title, body)
    select a.user_id, new.issue_id, new.requested_by,
           'appeal_submitted'::notification_type, heading,
           left(coalesce(subject, '') ||
                case when new.note is null then '' else ' — ' || new.note end,
                280)
      from appeal_approvers(new.project_id) as a (user_id)
     where a.user_id <> new.requested_by;

    return null;
  end if;

  if new.status = old.status then
    return null;
  end if;

  if new.status = 'approved' then
    heading := case new.kind
      when 'create' then 'Your issue was approved'
      else 'Completion approved'
    end;
  elsif new.status = 'rejected' then
    heading := case new.kind
      when 'create' then 'Your issue was declined'
      else 'Completion declined'
    end;
  else
    return null;
  end if;

  insert into notifications (user_id, issue_id, actor_id, type, title, body)
  values (
    new.requested_by,
    coalesce(new.created_issue_id, new.issue_id),
    coalesce(new.decided_by, new.requested_by),
    case new.status
      when 'approved' then 'appeal_approved'::notification_type
      else 'appeal_rejected'::notification_type
    end,
    heading,
    left(coalesce(new.decision_note, coalesce(new.title, '')), 280)
  );

  return null;
end;
$$;

drop trigger if exists notify_appeal_insert on issue_appeals;
create trigger notify_appeal_insert
  after insert on issue_appeals
  for each row execute function notify_appeal();

drop trigger if exists notify_appeal_update on issue_appeals;
create trigger notify_appeal_update
  after update of status on issue_appeals
  for each row execute function notify_appeal();

-- ---------------------------------------------------------------------------
-- notify_issue_subscribed
-- ---------------------------------------------------------------------------
-- When someone starts following an issue, the people already responsible for it
-- hear about it: the leads of the owning team, whoever is assigned, and whoever
-- already follows it. The new subscriber is never told about themselves, and
-- distinct on collapses a lead who is also an assignee into one row.

create or replace function notify_issue_subscribed()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  issue_title text;
  actor_name text;
  owning_project uuid;
begin
  select i.name, i.project_id into issue_title, owning_project
    from issues i where i.id = new.issue_id;

  select coalesce(p.display_name, 'Someone') into actor_name
    from profiles p where p.id = new.user_id;

  insert into notifications (user_id, issue_id, actor_id, type, title, body)
  select distinct on (candidate.user_id)
         candidate.user_id, new.issue_id, new.user_id,
         'subscribed_to'::notification_type,
         actor_name || ' is now following this issue',
         left(coalesce(issue_title, ''), 280)
    from (
      select tm.user_id
        from team_members tm
        join projects p on p.id = owning_project and p.team_id = tm.team_id
       where tm.role = 'lead'
      union
      select ia.user_id from issue_assignees ia where ia.issue_id = new.issue_id
      union
      select s.user_id from issue_subscribers s where s.issue_id = new.issue_id
    ) as candidate
   where candidate.user_id <> new.user_id;

  return null;
end;
$$;

drop trigger if exists notify_issue_subscribed on issue_subscribers;
create trigger notify_issue_subscribed
  after insert on issue_subscribers
  for each row execute function notify_issue_subscribed();

-- ---------------------------------------------------------------------------
-- require_lead_for_completion
-- ---------------------------------------------------------------------------
-- An issue reaches a completed state only through someone entitled to inspect
-- it. Everyone else raises a completion appeal.
--
-- The check is skipped when auth.uid() is null, which is the owner path used by
-- server actions: the database cannot identify the actor there, so assertCan is
-- the gate on that side. Whenever the actor *is* known — every client-side write
-- through Supabase, and every server action that sets the claim for the
-- transaction — the database enforces it too.

create or replace function require_lead_for_completion()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  old_group state_group;
  new_group state_group;
begin
  if actor is null or new.state_id = old.state_id then
    return new;
  end if;

  select s.group into old_group from states s where s.id = old.state_id;
  select s.group into new_group from states s where s.id = new.state_id;

  if new_group = 'completed' and old_group <> 'completed'
     and not can_decide_appeal(actor, new.project_id) then
    raise exception 'COMPLETION_NEEDS_LEAD'
      using hint = 'Raise a completion appeal for a team lead to confirm.';
  end if;

  return new;
end;
$$;

drop trigger if exists require_lead_for_completion on issues;
create trigger require_lead_for_completion
  before update of state_id on issues
  for each row execute function require_lead_for_completion();
