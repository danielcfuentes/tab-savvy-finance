-- Add due_date_next field and make due_date nullable
ALTER TABLE public.income 
  ADD COLUMN IF NOT EXISTS due_date_next TIMESTAMPTZ NULL;

-- Make due_date nullable (dates only required when amount > 0)
ALTER TABLE public.income 
  ALTER COLUMN due_date DROP NOT NULL;

-- Create index for due_date_next
CREATE INDEX IF NOT EXISTS idx_income_due_date_next ON public.income(due_date_next);

