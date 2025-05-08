-- Corrigir os triggers de convite para evitar erros ao cadastrar usuários

-- Remover os triggers existentes
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;

-- Recriar a função para processar convites na criação do usuário
CREATE OR REPLACE FUNCTION handle_invite_redemption()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar se o e-mail do novo usuário corresponde a algum convite
  UPDATE user_invites
  SET used = TRUE, updated_at = NOW()
  WHERE email = NEW.email AND used = FALSE;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Logar o erro mas permitir que o usuário seja criado
    RAISE LOG 'Erro ao processar convite para %: %', NEW.email, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recriar a função para processar convites na confirmação do usuário
CREATE OR REPLACE FUNCTION handle_confirmed_user_invite()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar se o usuário confirmou o e-mail
  IF NEW.email_confirmed_at IS NOT NULL AND 
     (OLD.email_confirmed_at IS NULL OR OLD.email_confirmed_at != NEW.email_confirmed_at) THEN
    
    -- Atualizar os convites para este e-mail
    UPDATE user_invites
    SET used = TRUE, updated_at = NOW()
    WHERE email = NEW.email AND used = FALSE;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Logar o erro mas permitir que a confirmação prossiga
    RAISE LOG 'Erro ao processar confirmação de convite para %: %', NEW.email, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recriar os triggers com tratamento de erros
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE handle_invite_redemption();

CREATE TRIGGER on_auth_user_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (NEW.email_confirmed_at IS NOT NULL AND 
        (OLD.email_confirmed_at IS NULL OR OLD.email_confirmed_at != NEW.email_confirmed_at))
  EXECUTE PROCEDURE handle_confirmed_user_invite();
