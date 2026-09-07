-- 1. Safely create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tier text NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro')),
    updated_at timestamptz DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

-- 3. Safely recreate the Policy
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can read own subscription" ON public.user_subscriptions;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can read own subscription"
    ON public.user_subscriptions FOR SELECT
    USING (auth.uid() = user_id);

-- 4. Create the trigger function safely
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS TRIGGER AS $$
BEGIN
    -- Use ON CONFLICT DO NOTHING just in case the subscription was already created somehow
    INSERT INTO public.user_subscriptions (user_id, tier)
    VALUES (new.id, 'free')
    ON CONFLICT (user_id) DO NOTHING;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Safely recreate the Trigger
DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;

CREATE TRIGGER on_auth_user_created_subscription
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_subscription();

-- 6. Backfill existing users just in case
INSERT INTO public.user_subscriptions (user_id, tier)
SELECT id, 'free' FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- 7. Ensure the RPC upgrade function exists and is completely safe
CREATE OR REPLACE FUNCTION public.upgrade_to_pro()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_subscriptions (user_id, tier, updated_at)
  VALUES (auth.uid(), 'pro', now())
  ON CONFLICT (user_id)
  DO UPDATE SET tier = 'pro', updated_at = now();
END;
$$;
