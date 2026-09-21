-- pgTAP powers the database test suite under supabase/tests (master spec
-- section 54/57). Installed via migration rather than left to the test
-- runner to bootstrap implicitly, so `supabase test db` behaves the same
-- way for every developer and CI run.
--
-- Note for the eventual hosted migration (section 94): this extension is
-- test tooling, not application schema. Revisit whether to exclude it from
-- the migrations applied to the hosted project at that point.
create extension if not exists pgtap with schema extensions;
