-- 0014_one_reaction_per_comment.sql
-- One reaction per person per comment.
--
-- The constraint was (comment_id, user_id, emoji), which stopped the same
-- person adding the same emoji twice but let them stack every emoji in the
-- picker onto one comment. The rule the user wants is simpler: a person holds
-- at most one reaction on a comment, and choosing another replaces it.
--
-- Existing rows are deduplicated first, keeping each person's earliest reaction
-- on a given comment, because that is the one they chose deliberately rather
-- than the ones added on top.
--
-- Idempotent: the drop and the dedupe are both conditional on the old shape
-- still being in place.

delete from comment_reactions cr
 where exists (
   select 1 from comment_reactions keep
    where keep.comment_id = cr.comment_id
      and keep.user_id = cr.user_id
      and (keep.created_at, keep.id) < (cr.created_at, cr.id)
 );

alter table comment_reactions
  drop constraint if exists comment_reactions_comment_id_user_id_emoji_key;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'comment_reactions'::regclass
       and conname = 'comment_reactions_comment_id_user_id_key'
  ) then
    alter table comment_reactions
      add constraint comment_reactions_comment_id_user_id_key
      unique (comment_id, user_id);
  end if;
end
$$;
