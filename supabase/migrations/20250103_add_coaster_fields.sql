-- Add missing fields to coaster_items table
ALTER TABLE public.coaster_items 
ADD COLUMN bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
ADD COLUMN category TEXT DEFAULT 'General';

-- Create index for better performance
CREATE INDEX idx_coaster_items_bank_account_id ON public.coaster_items(bank_account_id);
CREATE INDEX idx_coaster_items_category ON public.coaster_items(category);

