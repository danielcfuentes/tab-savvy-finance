-- Phase 2: Add optional fields to coaster_items
-- Adds bank_account_id (FK to bank_accounts.id) and category (TEXT)
-- Safe to run multiple times thanks to IF NOT EXISTS checks

-- bank_account_id (nullable) → link an expense to a bank account
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'coaster_items'
      AND column_name  = 'bank_account_id'
  ) THEN
    ALTER TABLE public.coaster_items
      ADD COLUMN bank_account_id UUID NULL;

    -- Add FK constraint if it doesn't already exist
    ALTER TABLE public.coaster_items
      ADD CONSTRAINT coaster_items_bank_account_id_fkey
        FOREIGN KEY (bank_account_id)
        REFERENCES public.bank_accounts(id)
        ON DELETE SET NULL;
  END IF;
END$$;

-- category (nullable text with default)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'coaster_items'
      AND column_name  = 'category'
  ) THEN
    ALTER TABLE public.coaster_items
      ADD COLUMN category TEXT NULL DEFAULT 'General';
  END IF;
END$$;

-- Helpful indexes (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'idx_coaster_items_bank_account_id' AND n.nspname = 'public'
  ) THEN
    CREATE INDEX idx_coaster_items_bank_account_id ON public.coaster_items(bank_account_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'idx_coaster_items_category' AND n.nspname = 'public'
  ) THEN
    CREATE INDEX idx_coaster_items_category ON public.coaster_items(category);
  END IF;
END$$;

-- Optional: update updated_at trigger to touch row (no-op for schema cache, but safe)
UPDATE public.coaster_items SET updated_at = NOW() WHERE FALSE;


