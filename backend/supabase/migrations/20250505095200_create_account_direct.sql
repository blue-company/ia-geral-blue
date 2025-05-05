-- Função para criar diretamente uma conta para um usuário específico
-- Esta função contorna os triggers existentes na tabela basejump.accounts

CREATE OR REPLACE FUNCTION public.create_account_for_user(user_id UUID)
RETURNS void AS $$
DECLARE
  user_email TEXT;
  user_name TEXT;
BEGIN
  -- Verificar se a conta já existe
  IF EXISTS (SELECT 1 FROM basejump.accounts WHERE id = user_id) THEN
    RAISE NOTICE 'Conta já existe para o usuário %', user_id;
    RETURN;
  END IF;

  -- Obter o email do usuário
  SELECT email INTO user_email FROM auth.users WHERE id = user_id;
  
  -- Extrair nome do usuário do email
  IF user_email IS NOT NULL THEN
    user_name := split_part(user_email, '@', 1);
  ELSE
    user_name := 'User ' || substr(user_id::text, 1, 8);
  END IF;
  
  -- Inserir diretamente na tabela accounts com todos os campos necessários
  -- Usando ALTER TABLE para desativar temporariamente os triggers
  BEGIN
    -- Desativar temporariamente os triggers
    ALTER TABLE basejump.accounts DISABLE TRIGGER ALL;
    
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
      user_id,
      NOW(),
      NOW(),
      user_name,
      user_id,
      true,
      null,
      '{}'::jsonb,
      '{}'::jsonb
    );
    
    -- Reativar os triggers
    ALTER TABLE basejump.accounts ENABLE TRIGGER ALL;
    
    RAISE NOTICE 'Conta criada com sucesso para o usuário %', user_id;
  EXCEPTION WHEN OTHERS THEN
    -- Garantir que os triggers sejam reativados mesmo em caso de erro
    ALTER TABLE basejump.accounts ENABLE TRIGGER ALL;
    RAISE EXCEPTION 'Erro ao criar conta: %', SQLERRM;
  END;
  
  -- Também criar entrada na tabela account_user para permissões
  BEGIN
    -- Desativar temporariamente os triggers
    ALTER TABLE basejump.account_user DISABLE TRIGGER ALL;
    
    INSERT INTO basejump.account_user (
      account_id,
      user_id,
      account_role
    ) VALUES (
      user_id,
      user_id,
      'owner'
    )
    ON CONFLICT (account_id, user_id) DO NOTHING;
    
    -- Reativar os triggers
    ALTER TABLE basejump.account_user ENABLE TRIGGER ALL;
    
    RAISE NOTICE 'Permissões configuradas para o usuário %', user_id;
  EXCEPTION WHEN OTHERS THEN
    -- Garantir que os triggers sejam reativados mesmo em caso de erro
    ALTER TABLE basejump.account_user ENABLE TRIGGER ALL;
    RAISE EXCEPTION 'Erro ao configurar permissões: %', SQLERRM;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Exemplo de uso:
-- SELECT create_account_for_user('f772ae59-462d-4c66-8b93-0add181e0177');

-- Para criar uma conta para um usuário específico, substitua o UUID acima pelo ID do usuário
-- e descomente a linha
