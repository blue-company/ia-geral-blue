-- Migração para corrigir o problema de violação de chave estrangeira
-- Esta migração cria uma função e um trigger que garantem que a conta exista antes de inserir um thread

-- Remover triggers anteriores para garantir uma instalação limpa
DROP TRIGGER IF EXISTS trigger_auto_create_account_threads ON threads;
DROP TRIGGER IF EXISTS trigger_auto_create_account_projects ON projects;
DROP FUNCTION IF EXISTS public.auto_create_account_on_thread_or_project();

-- Função para criar automaticamente uma conta quando um thread ou projeto é criado
CREATE OR REPLACE FUNCTION public.ensure_account_exists()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT;
  user_name TEXT;
  account_slug TEXT;
BEGIN
  -- Verificar se a conta já existe
  IF NOT EXISTS (SELECT 1 FROM basejump.accounts WHERE id = NEW.account_id) THEN
    -- Tentar obter o email do usuário
    BEGIN
      SELECT email INTO user_email FROM auth.users WHERE id = NEW.account_id;
      
      -- Extrair nome do usuário do email
      IF user_email IS NOT NULL THEN
        user_name := split_part(user_email, '@', 1);
      ELSE
        user_name := 'User ' || substr(NEW.account_id::text, 1, 8);
      END IF;
      
      -- Criar slug baseado no nome
      account_slug := lower(regexp_replace(user_name, '[^a-zA-Z0-9]', '-', 'g'));
      
      -- Inserir nova conta
      INSERT INTO basejump.accounts (
        id,
        created_at,
        updated_at,
        name,
        primary_owner_user_id,
        personal_account,
        slug,
        private_metadata,
        public_metadata
      ) VALUES (
        NEW.account_id,
        NOW(),
        NOW(),
        user_name,
        NEW.account_id,
        true,
        null,
        '{}'::jsonb,
        '{}'::jsonb
      );
      
      -- Também criar entrada na tabela account_user para permissões
      INSERT INTO basejump.account_user (
        account_id,
        user_id,
        account_role
      ) VALUES (
        NEW.account_id,
        NEW.account_id,
        'owner'
      );
      
      RAISE NOTICE 'Conta criada automaticamente para o usuário %', NEW.account_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Erro ao criar conta automaticamente: %', SQLERRM;
      -- Importante: Não lançar exceção aqui para evitar interromper a operação
      -- Apenas registrar o erro e continuar
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para a tabela threads
DROP TRIGGER IF EXISTS ensure_account_exists_before_thread ON threads;
CREATE TRIGGER ensure_account_exists_before_thread
BEFORE INSERT ON threads
FOR EACH ROW
EXECUTE FUNCTION public.ensure_account_exists();

-- Trigger para a tabela projects
DROP TRIGGER IF EXISTS ensure_account_exists_before_project ON projects;
CREATE TRIGGER ensure_account_exists_before_project
BEFORE INSERT ON projects
FOR EACH ROW
EXECUTE FUNCTION public.ensure_account_exists();
