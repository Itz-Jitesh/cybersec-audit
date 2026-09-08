-- 0001_extensions.sql
-- Extensions the schema depends on.
--
-- Run order for the whole database, which is not simply "Drizzle then SQL":
--   1. this file, because invites.email is citext and every primary key
--      defaults to gen_random_uuid(), so both extensions must exist before the
--      Drizzle migration creates any table
--   2. drizzle/0000_*.sql, via pnpm db:migrate
--   3. the remaining files here in numeric order
--
-- pgcrypto provides gen_random_uuid(), which every primary key defaults to.
-- citext backs invites.email so an OAuth provider returning a different casing
-- than the one the invite was addressed to still matches.

create extension if not exists pgcrypto;
create extension if not exists citext;
