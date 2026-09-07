-- 1. Drop the trigger entirely so user signups stop crashing
DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;

-- 2. Drop the function to completely clear it
DROP FUNCTION IF EXISTS public.handle_new_user_subscription();
