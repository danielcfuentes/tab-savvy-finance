-- Create bills table (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'bills'
  ) THEN
    CREATE TABLE public.bills (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('Rent', 'Need', 'Want', 'Debt', 'Savings', 'Investment')),
      payment_date TIMESTAMPTZ NOT NULL,
      payment_date_next TIMESTAMPTZ NULL,
      amount_now DECIMAL(12, 2) NOT NULL DEFAULT 0,
      amount_next DECIMAL(12, 2) NOT NULL DEFAULT 0,
      bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
      scheduled_type TEXT NOT NULL CHECK (scheduled_type IN ('Scheduled', 'Autopay')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
END$$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_bills_user_id ON public.bills(user_id);
CREATE INDEX IF NOT EXISTS idx_bills_payment_date ON public.bills(payment_date);
CREATE INDEX IF NOT EXISTS idx_bills_payment_date_next ON public.bills(payment_date_next);

-- Enable Row Level Security (idempotent)
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

-- Bills RLS Policies (idempotent)
DO $$
BEGIN
  -- Users can view their own bills
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

  -- Users can create their own bills
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

  -- Users can update their own bills
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

  -- Users can delete their own bills
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

