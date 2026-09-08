-- 0002_search_vector.sql
-- Full-text search column for the Cmd+K palette.
--
-- This is a generated column, which Drizzle cannot express reliably, so it is
-- hand-authored here. Generating it in the database rather than maintaining it
-- from application code means it can never drift from the row it describes.

alter table issues
  add column if not exists search_vector tsvector
  generated always as (
    to_tsvector(
      'english',
      coalesce(name, '') || ' ' || coalesce(description_html, '')
    )
  ) stored;

create index if not exists issues_search_vector_idx
  on issues using gin (search_vector);
