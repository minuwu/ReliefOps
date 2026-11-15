-- Local development only: creates the two database users and both databases
-- (backend-development-guide.md §3.3). Safe to run more than once.
--
--   psql -h localhost -U postgres -f backend/scripts/bootstrap_db.sql
--
-- On a hosted Postgres (Neon, Supabase, ...) create the same two roles in the
-- provider's console instead, with strong passwords, and skip this file.
--
--   migrator  owns the tables; runs only Alembic and the seed.
--   app_user  what the app connects as; not an owner, no BYPASSRLS,
--             so row-level security always applies to it.

\set ON_ERROR_STOP on

SELECT 'CREATE ROLE migrator LOGIN PASSWORD ''migrator_password'' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS'
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'migrator') \gexec

SELECT 'CREATE ROLE app_user LOGIN PASSWORD ''app_password'' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS'
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') \gexec

SELECT 'CREATE DATABASE fraud_relief OWNER migrator ENCODING ''UTF8'' TEMPLATE template0'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'fraud_relief') \gexec

SELECT 'CREATE DATABASE fraud_relief_test OWNER migrator ENCODING ''UTF8'' TEMPLATE template0'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'fraud_relief_test') \gexec

-- Same schema permissions in both databases: only migrator may create objects.
\connect fraud_relief
REVOKE ALL ON DATABASE fraud_relief FROM PUBLIC;
GRANT CONNECT ON DATABASE fraud_relief TO migrator, app_user;
ALTER SCHEMA public OWNER TO migrator;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO app_user;

\connect fraud_relief_test
REVOKE ALL ON DATABASE fraud_relief_test FROM PUBLIC;
GRANT CONNECT ON DATABASE fraud_relief_test TO migrator, app_user;
ALTER SCHEMA public OWNER TO migrator;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO app_user;
