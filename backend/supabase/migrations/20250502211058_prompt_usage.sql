-- Create a table to store user prompt usage
CREATE TABLE IF NOT EXISTS prompt_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Create a table to store user invites
CREATE TABLE IF NOT EXISTS user_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inviter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invite_code UUID NOT NULL DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(invite_code)
);

-- Create RLS policies for prompt_usage
ALTER TABLE prompt_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own prompt usage"
  ON prompt_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all prompt usage"
  ON prompt_usage
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Create RLS policies for user_invites
ALTER TABLE user_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own invites"
  ON user_invites FOR SELECT
  USING (auth.uid() = inviter_id);

CREATE POLICY "Users can create their own invites"
  ON user_invites FOR INSERT
  WITH CHECK (auth.uid() = inviter_id);

CREATE POLICY "Service role can manage all invites"
  ON user_invites
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Create function to handle invite redemption
CREATE OR REPLACE FUNCTION handle_invite_redemption()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if the new user has an invite
  UPDATE user_invites
  SET used = TRUE, updated_at = NOW()
  WHERE email = NEW.email AND used = FALSE;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to handle invite redemption when a new user signs up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE handle_invite_redemption();