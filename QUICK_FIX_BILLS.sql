-- QUICK FIX: Run this in Supabase SQL Editor to fix the bills table
-- This will copy data from due_date to payment_date (if needed) and drop due_date columns

-- Step 1: Check current columns (for reference)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'bills'
ORDER BY ordinal_position;

-- Step 2: Copy data from due_date to payment_date if due_date exists and has data
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bills' AND column_name = 'due_date'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bills' AND column_name = 'payment_date'
  ) THEN
    -- Copy data from due_date to payment_date where payment_date is null
    UPDATE public.bills
    SET payment_date = due_date
    WHERE payment_date IS NULL AND due_date IS NOT NULL;
    
    RAISE NOTICE 'Copied data from due_date to payment_date';
  END IF;
END$$;

-- Step 3: Copy data from due_date_next to payment_date_next if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bills' AND column_name = 'due_date_next'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bills' AND column_name = 'payment_date_next'
  ) THEN
    -- Copy data from due_date_next to payment_date_next where payment_date_next is null
    UPDATE public.bills
    SET payment_date_next = due_date_next
    WHERE payment_date_next IS NULL AND due_date_next IS NOT NULL;
    
    RAISE NOTICE 'Copied data from due_date_next to payment_date_next';
  END IF;
END$$;

-- Step 4: Drop the old due_date column if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bills' AND column_name = 'due_date'
  ) THEN
    ALTER TABLE public.bills DROP COLUMN due_date;
    RAISE NOTICE 'Dropped due_date column';
  ELSE
    RAISE NOTICE 'due_date column does not exist';
  END IF;
END$$;

-- Step 5: Drop the old due_date_next column if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bills' AND column_name = 'due_date_next'
  ) THEN
    ALTER TABLE public.bills DROP COLUMN due_date_next;
    RAISE NOTICE 'Dropped due_date_next column';
  ELSE
    RAISE NOTICE 'due_date_next column does not exist';
  END IF;
END$$;

-- Step 6: Verify the columns (should only show payment_date and payment_date_next)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'bills'
ORDER BY ordinal_position;

