-- Create the user_subscriptions table
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tier text NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro')),
    updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Create policy for users to read their own subscription
CREATE POLICY "Users can read own subscription"
    ON public.user_subscriptions FOR SELECT
    USING (auth.uid() = user_id);

-- Create a trigger to automatically create a free subscription on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_subscriptions (user_id, tier)
    VALUES (new.id, 'free');
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if trigger exists and drop it before creating to ensure idempotency
DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;

CREATE TRIGGER on_auth_user_created_subscription
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_subscription();

-- Backfill existing users
INSERT INTO public.user_subscriptions (user_id, tier)
SELECT id, 'free' FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
