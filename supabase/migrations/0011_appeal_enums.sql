-- 0011_appeal_enums.sql
-- The enum additions the appeal workflow needs, in a file of their own.
--
-- Postgres refuses to use an enum value in the same transaction that added it,
-- and the applier sends each file as one implicit transaction, so these cannot
-- live alongside the table in 0012 that defaults to one of them. Idempotent:
-- every add is guarded by a lookup in pg_enum.

do $$
declare
  wanted text;
begin
  foreach wanted in array array[
    'subscribed_to',
    'appeal_submitted',
    'appeal_approved',
    'appeal_rejected'
  ]
  loop
    if not exists (
      select 1 from pg_enum
      where enumtypid = 'notification_type'::regtype
        and enumlabel = wanted
    ) then
      execute format(
        'alter type notification_type add value %L', wanted
      );
    end if;
  end loop;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'appeal_kind') then
    create type appeal_kind as enum ('create', 'complete');
  end if;
  if not exists (select 1 from pg_type where typname = 'appeal_status') then
    create type appeal_status as enum
      ('pending', 'approved', 'rejected', 'cancelled');
  end if;
end
$$;
