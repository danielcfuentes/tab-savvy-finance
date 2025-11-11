-- Rollback: Remove subscriptions table and all related objects

-- Drop the function first
DROP FUNCTION IF EXISTS public.user_has_active_subscription(UUID);

-- Drop RLS policies
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can insert their own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can update their own subscriptions" ON public.subscriptions;

-- Drop indexes
DROP INDEX IF EXISTS public.idx_subscriptions_user_id;
DROP INDEX IF EXISTS public.idx_subscriptions_status;

-- Drop the table (this will also remove RLS since it's on the table)
DROP TABLE IF EXISTS public.subscriptions;

