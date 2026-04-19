-- PL6a (part 1/2): add plan_status enum value only.
-- Must run in a separate migration from any SQL that references 'awaiting_payment'
-- (PostgreSQL: new enum labels are not usable until committed — error 55P04).

DO $$ BEGIN
  ALTER TYPE public.plan_status ADD VALUE 'awaiting_payment';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
