-- Rename due_date columns to payment_date columns if they exist
-- This fixes the schema mismatch where the table was created with wrong column names

-- Rename due_date to payment_date if due_date exists and payment_date doesn't
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bills'
      AND column_name = 'due_date'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bills'
      AND column_name = 'payment_date'
  ) THEN
    ALTER TABLE public.bills
      RENAME COLUMN due_date TO payment_date;
  END IF;
END$$;

-- Rename due_date_next to payment_date_next if due_date_next exists and payment_date_next doesn't
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bills'
      AND column_name = 'due_date_next'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bills'
      AND column_name = 'payment_date_next'
  ) THEN
    ALTER TABLE public.bills
      RENAME COLUMN due_date_next TO payment_date_next;
  END IF;
END$$;

-- Update indexes if they reference the old column names
DO $$
BEGIN
  -- Drop old index if it exists
  IF EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'bills'
      AND indexname = 'idx_bills_due_date'
  ) THEN
    DROP INDEX IF EXISTS public.idx_bills_due_date;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'bills'
      AND indexname = 'idx_bills_due_date_next'
  ) THEN
    DROP INDEX IF EXISTS public.idx_bills_due_date_next;
  END IF;
END$$;

-- Ensure correct indexes exist
CREATE INDEX IF NOT EXISTS idx_bills_payment_date ON public.bills(payment_date);
CREATE INDEX IF NOT EXISTS idx_bills_payment_date_next ON public.bills(payment_date_next);

