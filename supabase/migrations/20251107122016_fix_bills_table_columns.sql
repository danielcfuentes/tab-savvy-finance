-- Fix bills table: Add missing columns if they don't exist
-- This migration ensures the bills table has all required columns

-- Handle payment_date: rename from due_date if it exists, or add if it doesn't
DO $$
BEGIN
  -- First, check if due_date exists and rename it
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
  -- If payment_date doesn't exist at all, add it
  ELSIF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bills'
      AND column_name = 'payment_date'
  ) THEN
    ALTER TABLE public.bills
      ADD COLUMN payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
END$$;

-- Handle payment_date_next: rename from due_date_next if it exists, or add if it doesn't
DO $$
BEGIN
  -- First, check if due_date_next exists and rename it
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
  -- If payment_date_next doesn't exist at all, add it
  ELSIF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bills'
      AND column_name = 'payment_date_next'
  ) THEN
    ALTER TABLE public.bills
      ADD COLUMN payment_date_next TIMESTAMPTZ NULL;
  END IF;
END$$;

-- Add category column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bills'
      AND column_name = 'category'
  ) THEN
    ALTER TABLE public.bills
      ADD COLUMN category TEXT NOT NULL DEFAULT 'Need';
    
    -- Add check constraint for category
    ALTER TABLE public.bills
      ADD CONSTRAINT bills_category_check
      CHECK (category IN ('Rent', 'Need', 'Want', 'Debt', 'Savings', 'Investment'));
  END IF;
END$$;

-- Add amount_now column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bills'
      AND column_name = 'amount_now'
  ) THEN
    ALTER TABLE public.bills
      ADD COLUMN amount_now DECIMAL(12, 2) NOT NULL DEFAULT 0;
  END IF;
END$$;

-- Add amount_next column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bills'
      AND column_name = 'amount_next'
  ) THEN
    ALTER TABLE public.bills
      ADD COLUMN amount_next DECIMAL(12, 2) NOT NULL DEFAULT 0;
  END IF;
END$$;

-- Add scheduled_type column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bills'
      AND column_name = 'scheduled_type'
  ) THEN
    ALTER TABLE public.bills
      ADD COLUMN scheduled_type TEXT NOT NULL DEFAULT 'Scheduled';
    
    -- Add check constraint for scheduled_type
    ALTER TABLE public.bills
      ADD CONSTRAINT bills_scheduled_type_check
      CHECK (scheduled_type IN ('Scheduled', 'Autopay'));
  END IF;
END$$;

-- Add bank_account_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bills'
      AND column_name = 'bank_account_id'
  ) THEN
    -- First, check if we have any bills - if not, we can make it NOT NULL
    -- If we have bills, we need to handle existing data
    IF EXISTS (SELECT 1 FROM public.bills LIMIT 1) THEN
      -- If bills exist, add as nullable first, then update
      ALTER TABLE public.bills
        ADD COLUMN bank_account_id UUID NULL;
      
      -- You'll need to manually update existing bills with a valid bank_account_id
      -- For now, we'll just add the column
    ELSE
      -- No bills exist, so we can make it NOT NULL
      ALTER TABLE public.bills
        ADD COLUMN bank_account_id UUID NOT NULL;
      
      -- Add foreign key constraint
      ALTER TABLE public.bills
        ADD CONSTRAINT bills_bank_account_id_fkey
        FOREIGN KEY (bank_account_id)
        REFERENCES public.bank_accounts(id)
        ON DELETE CASCADE;
    END IF;
  END IF;
END$$;

-- Ensure foreign key constraint exists for bank_account_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'bills'
      AND constraint_name = 'bills_bank_account_id_fkey'
  ) THEN
    -- Only add if column exists and is not null
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'bills'
        AND column_name = 'bank_account_id'
    ) THEN
      ALTER TABLE public.bills
        ADD CONSTRAINT bills_bank_account_id_fkey
        FOREIGN KEY (bank_account_id)
        REFERENCES public.bank_accounts(id)
        ON DELETE CASCADE;
    END IF;
  END IF;
END$$;

-- Drop old indexes if they exist (from due_date columns)
DROP INDEX IF EXISTS public.idx_bills_due_date;
DROP INDEX IF EXISTS public.idx_bills_due_date_next;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_bills_user_id ON public.bills(user_id);
CREATE INDEX IF NOT EXISTS idx_bills_payment_date ON public.bills(payment_date);
CREATE INDEX IF NOT EXISTS idx_bills_payment_date_next ON public.bills(payment_date_next);

-- Enable Row Level Security if not already enabled
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename = 'bills'
      AND rowsecurity = true
  ) THEN
    ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
  END IF;
END$$;

-- Create RLS policies if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'bills'
      AND policyname = 'Users can view their own bills'
  ) THEN
    CREATE POLICY "Users can view their own bills"
      ON public.bills FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'bills'
      AND policyname = 'Users can create their own bills'
  ) THEN
    CREATE POLICY "Users can create their own bills"
      ON public.bills FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'bills'
      AND policyname = 'Users can update their own bills'
  ) THEN
    CREATE POLICY "Users can update their own bills"
      ON public.bills FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'bills'
      AND policyname = 'Users can delete their own bills'
  ) THEN
    CREATE POLICY "Users can delete their own bills"
      ON public.bills FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END$$;

-- Add updated_at trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_bills_updated_at'
  ) THEN
    CREATE TRIGGER set_bills_updated_at
      BEFORE UPDATE ON public.bills
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END$$;

