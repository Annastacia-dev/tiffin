-- Prisma creates _prisma_migrations in the public schema, which Supabase exposes through its API.
-- Lock it down like the other tables. The check is there because the table
-- doesn't exist in the shadow database Prisma uses for `migrate dev`.
DO $$
BEGIN
  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
    ALTER TABLE public._prisma_migrations ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;
