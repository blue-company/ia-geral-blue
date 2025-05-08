-- Function to handle invite redemption when a user confirms their account
CREATE OR REPLACE FUNCTION handle_confirmed_user_invite()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if the user has confirmed their email and has an invite code
  IF NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL THEN
    -- Find the invite associated with this email
    UPDATE user_invites
    SET used = TRUE, updated_at = NOW()
    WHERE email = NEW.email AND used = FALSE;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to handle invite redemption when a user confirms their account
DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL)
  EXECUTE PROCEDURE handle_confirmed_user_invite();