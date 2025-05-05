-- Migração para criar trigger que cria contas automaticamente quando necessário
-- Quando um thread ou projeto é criado com um account_id que não existe,
-- este trigger criará automaticamente a conta correspondente no esquema basejump

-- Remover triggers e funções anteriores para garantir uma instalação limpa
DROP TRIGGER IF EXISTS trigger_auto_create_account_threads ON threads;
DROP TRIGGER IF EXISTS trigger_auto_create_account_projects ON projects;
DROP TRIGGER IF EXISTS trigger_auto_create_account_on_user_creation ON auth.users;
DROP FUNCTION IF EXISTS public.auto_create_account_on_thread_or_project();
DROP FUNCTION IF EXISTS public.auto_create_account_on_user_creation();

-- Função para criar automaticamente uma conta quando um thread ou projeto é criado
CREATE OR REPLACE FUNCTION public.auto_create_account_on_thread_or_project()
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
        slug
      ) VALUES (
        NEW.account_id,
        NOW(),
        NOW(),
        user_name,
        NEW.account_id,
        false,
        account_slug
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
CREATE TRIGGER trigger_auto_create_account_threads
BEFORE INSERT ON threads
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_account_on_thread_or_project();

-- Trigger para a tabela projects
CREATE TRIGGER trigger_auto_create_account_projects
BEFORE INSERT ON projects
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_account_on_thread_or_project();
