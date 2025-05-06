-- Migração para corrigir o processamento de convites
-- Esta migração atualiza os triggers existentes para processar corretamente os convites
-- quando um usuário se cadastra usando um link de convite

-- 1. Garantir que a tabela user_invites tenha as colunas necessárias
DO $$
BEGIN
  -- Adicionar coluna used_at se não existir
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'user_invites' AND column_name = 'used_at'
  ) THEN
    ALTER TABLE user_invites ADD COLUMN used_at TIMESTAMP WITH TIME ZONE;
  END IF;

  -- Adicionar coluna used_by se não existir
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'user_invites' AND column_name = 'used_by'
  ) THEN
    ALTER TABLE user_invites ADD COLUMN used_by UUID REFERENCES auth.users(id);
  END IF;

  -- Adicionar coluna used_count se não existir
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'user_invites' AND column_name = 'used_count'
  ) THEN
    ALTER TABLE user_invites ADD COLUMN used_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- 2. Atualizar a função que processa os convites na criação do usuário
CREATE OR REPLACE FUNCTION handle_invite_redemption()
RETURNS TRIGGER AS $$
DECLARE
  invite_code_val UUID;
  inviter_id_val UUID;
BEGIN
  -- Verificar se o usuário tem um código de convite nos metadados
  BEGIN
    invite_code_val := (NEW.raw_user_meta_data->>'invite_code')::UUID;
  EXCEPTION WHEN OTHERS THEN
    -- Se não for um UUID válido ou não existir, continuar sem erro
    invite_code_val := NULL;
  END;

  -- Se tiver um código de convite válido, processar
  IF invite_code_val IS NOT NULL THEN
    -- Atualizar o convite com as informações do novo usuário
    UPDATE user_invites ui
    SET 
      used = TRUE, 
      used_at = NOW(), 
      used_by = NEW.id,
      used_count = COALESCE(used_count, 0) + 1,
      updated_at = NOW()
    WHERE ui.invite_code = invite_code_val
    RETURNING ui.inviter_id INTO inviter_id_val;

    -- Se encontrou um convite válido, incrementar o bonus_count do usuário que convidou
    IF inviter_id_val IS NOT NULL THEN
      -- Verificar se já existe um registro para o dia atual
      UPDATE prompt_usage
      SET bonus_count = COALESCE(bonus_count, 0) + 1
      WHERE user_id = inviter_id_val AND date = CURRENT_DATE;
      
      -- Se não existir, criar um novo registro
      IF NOT FOUND THEN
        INSERT INTO prompt_usage (user_id, count, bonus_count)
        VALUES (inviter_id_val, 0, 1);
      END IF;
    END IF;
  END IF;

  -- Também verificar se o e-mail do novo usuário corresponde a algum convite
  UPDATE user_invites ui
  SET 
    used = TRUE, 
    used_at = NOW(), 
    used_by = NEW.id,
    used_count = COALESCE(used_count, 0) + 1,
    updated_at = NOW()
  WHERE ui.email = NEW.email AND ui.used = FALSE
  RETURNING ui.inviter_id INTO inviter_id_val;

  -- Se encontrou um convite válido, incrementar o bonus_count do usuário que convidou
  IF inviter_id_val IS NOT NULL THEN
    -- Verificar se já existe um registro para o dia atual
    UPDATE prompt_usage
    SET bonus_count = COALESCE(bonus_count, 0) + 1
    WHERE user_id = inviter_id_val AND date = CURRENT_DATE;
    
    -- Se não existir, criar um novo registro
    IF NOT FOUND THEN
      INSERT INTO prompt_usage (user_id, count, bonus_count)
      VALUES (inviter_id_val, 0, 1);
    END IF;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Logar o erro mas permitir que o usuário seja criado
    RAISE LOG 'Erro ao processar convite para %: %', NEW.email, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Atualizar a função que processa os convites na confirmação do usuário
CREATE OR REPLACE FUNCTION handle_confirmed_user_invite()
RETURNS TRIGGER AS $$
DECLARE
  inviter_id_val UUID;
BEGIN
  -- Verificar se o usuário confirmou o e-mail
  IF NEW.email_confirmed_at IS NOT NULL AND 
     (OLD.email_confirmed_at IS NULL OR OLD.email_confirmed_at != NEW.email_confirmed_at) THEN
    
    -- Verificar se o usuário tem um código de convite nos metadados
    BEGIN
      DECLARE
        invite_code_val UUID := (NEW.raw_user_meta_data->>'invite_code')::UUID;
      BEGIN
        IF invite_code_val IS NOT NULL THEN
          -- Atualizar o convite com as informações do usuário confirmado
          UPDATE user_invites ui
          SET 
            used = TRUE, 
            used_at = NOW(), 
            used_by = NEW.id,
            used_count = COALESCE(used_count, 0) + 1,
            updated_at = NOW()
          WHERE ui.invite_code = invite_code_val
          RETURNING ui.inviter_id INTO inviter_id_val;

          -- Se encontrou um convite válido, incrementar o bonus_count do usuário que convidou
          IF inviter_id_val IS NOT NULL THEN
            -- Verificar se já existe um registro para o dia atual
            UPDATE prompt_usage
            SET bonus_count = COALESCE(bonus_count, 0) + 1
            WHERE user_id = inviter_id_val AND date = CURRENT_DATE;
            
            -- Se não existir, criar um novo registro
            IF NOT FOUND THEN
              INSERT INTO prompt_usage (user_id, count, bonus_count)
              VALUES (inviter_id_val, 0, 1);
            END IF;
          END IF;
        END IF;
      END;
    EXCEPTION WHEN OTHERS THEN
      -- Se não for um UUID válido ou não existir, continuar sem erro
      NULL;
    END;
    
    -- Também atualizar os convites para este e-mail
    UPDATE user_invites ui
    SET 
      used = TRUE, 
      used_at = NOW(), 
      used_by = NEW.id,
      used_count = COALESCE(used_count, 0) + 1,
      updated_at = NOW()
    WHERE ui.email = NEW.email AND ui.used = FALSE
    RETURNING ui.inviter_id INTO inviter_id_val;

    -- Se encontrou um convite válido, incrementar o bonus_count do usuário que convidou
    IF inviter_id_val IS NOT NULL THEN
      -- Verificar se já existe um registro para o dia atual
      UPDATE prompt_usage
      SET bonus_count = COALESCE(bonus_count, 0) + 1
      WHERE user_id = inviter_id_val AND date = CURRENT_DATE;
      
      -- Se não existir, criar um novo registro
      IF NOT FOUND THEN
        INSERT INTO prompt_usage (user_id, count, bonus_count)
        VALUES (inviter_id_val, 0, 1);
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Logar o erro mas permitir que a confirmação prossiga
    RAISE LOG 'Erro ao processar confirmação de convite para %: %', NEW.email, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Recriar os triggers com as funções atualizadas
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE handle_invite_redemption();

DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (NEW.email_confirmed_at IS NOT NULL AND 
        (OLD.email_confirmed_at IS NULL OR OLD.email_confirmed_at != NEW.email_confirmed_at))
  EXECUTE PROCEDURE handle_confirmed_user_invite();
