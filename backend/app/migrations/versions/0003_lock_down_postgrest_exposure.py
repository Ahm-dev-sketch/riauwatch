"""Lock down Supabase PostgREST exposure: enable RLS and revoke client-role grants.

Supabase auto-grants ``anon``/``authenticated`` full DML on every table in the
``public`` schema and exposes them through PostgREST. With RLS disabled that means
anyone holding the public ``anon`` key can read, edit and delete every row
(Supabase linter: ``rls_disabled_in_public``).

This application never uses PostgREST or supabase-js: the backend connects straight
to PostgreSQL as ``postgres`` (``rolbypassrls = true``), so enabling RLS does not
affect it, and revoking the Supabase client roles removes only access this project
does not use.

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-28
"""

from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None

# Enable RLS + revoke all client-role privileges across the public schema.
# Idempotent. Each statement is guarded so a non-owner object cannot abort the
# migration (PostGIS ``spatial_ref_sys`` is owned by ``supabase_admin``, and
# ``postgres`` is not a member of that role).
_LOCK_DOWN = """
DO $$
DECLARE
    r record;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        RAISE NOTICE 'no anon role (not a Supabase database); skipping lockdown';
        RETURN;
    END IF;

    FOR r IN
        SELECT c.relname, c.relkind
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind IN ('r', 'p', 'v', 'm', 'S')
    LOOP
        IF r.relkind IN ('r', 'p') THEN
            BEGIN
                EXECUTE format(
                    'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.relname
                );
            EXCEPTION WHEN insufficient_privilege THEN
                RAISE NOTICE 'cannot enable RLS on public.% (not owner)', r.relname;
            END;
        END IF;

        BEGIN
            IF r.relkind = 'S' THEN
                EXECUTE format(
                    'REVOKE ALL ON SEQUENCE public.%I FROM anon, authenticated', r.relname
                );
            ELSE
                EXECUTE format(
                    'REVOKE ALL ON TABLE public.%I FROM anon, authenticated', r.relname
                );
            END IF;
        EXCEPTION WHEN insufficient_privilege THEN
            RAISE NOTICE 'cannot revoke on public.% (not owner)', r.relname;
        END;
    END LOOP;
END $$;
"""

# Without this, every future ``alembic upgrade head`` re-creates the hole: Supabase's
# default privileges hand full DML to anon/authenticated for newly created tables.
_TIGHTEN_DEFAULT_PRIVS = """
DO $$
DECLARE
    grantor text;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        RETURN;
    END IF;

    FOREACH grantor IN ARRAY ARRAY['postgres', 'supabase_admin'] LOOP
        BEGIN
            EXECUTE format(
                'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public '
                'REVOKE ALL ON TABLES FROM anon, authenticated', grantor
            );
            EXECUTE format(
                'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public '
                'REVOKE ALL ON SEQUENCES FROM anon, authenticated', grantor
            );
            EXECUTE format(
                'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public '
                'REVOKE ALL ON FUNCTIONS FROM anon, authenticated', grantor
            );
        EXCEPTION WHEN insufficient_privilege THEN
            RAISE NOTICE 'cannot alter default privileges for role % (not member)', grantor;
        END;
    END LOOP;
END $$;
"""

# Deliberately restores the previously insecure state, for rollback only.
_RESTORE = """
DO $$
DECLARE
    r record;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        RETURN;
    END IF;

    FOR r IN
        SELECT c.relname, c.relkind
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind IN ('r', 'p', 'v', 'm', 'S')
    LOOP
        BEGIN
            IF r.relkind IN ('r', 'p') THEN
                EXECUTE format(
                    'ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', r.relname
                );
            END IF;
            IF r.relkind = 'S' THEN
                EXECUTE format(
                    'GRANT ALL ON SEQUENCE public.%I TO anon, authenticated', r.relname
                );
            ELSE
                EXECUTE format(
                    'GRANT ALL ON TABLE public.%I TO anon, authenticated', r.relname
                );
            END IF;
        EXCEPTION WHEN insufficient_privilege THEN
            RAISE NOTICE 'cannot restore public.% (not owner)', r.relname;
        END;
    END LOOP;
END $$;
"""


def _is_postgres() -> bool:
    return op.get_bind().dialect.name == "postgresql"


def upgrade() -> None:
    # SQLite/offline test databases have no RLS, roles or PostgREST.
    if not _is_postgres():
        return
    op.execute(_LOCK_DOWN)
    op.execute(_TIGHTEN_DEFAULT_PRIVS)


def downgrade() -> None:
    if not _is_postgres():
        return
    op.execute(_RESTORE)
