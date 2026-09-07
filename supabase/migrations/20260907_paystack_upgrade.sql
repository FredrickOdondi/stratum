-- Create a secure RPC function to upgrade a user to the 'pro' tier
-- This function can be called directly from the frontend securely using supabase.rpc()
CREATE OR REPLACE FUNCTION public.upgrade_to_pro()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with the privileges of the creator
AS $$
BEGIN
  -- Insert or Update the calling user's subscription to 'pro'
  INSERT INTO public.user_subscriptions (user_id, tier, updated_at)
  VALUES (auth.uid(), 'pro', now())
  ON CONFLICT (user_id)
  DO UPDATE SET tier = 'pro', updated_at = now();
END;
$$;
