-- Script para inserir diretamente uma conta para um usuário de teste
-- Este script é para ser executado diretamente no console SQL do Supabase
-- Comentado para evitar erro de violação de chave estrangeira, já que o usuário de teste
-- provavelmente não existe no banco de dados de homologação

/*
DO $$
DECLARE
  test_user_id UUID := 'f772ae59-462d-4c66-8b93-0add181e0177'::uuid;
  test_user_name TEXT := 'user_test';
BEGIN
  -- Inserir na tabela basejump.accounts
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
  ) 
  VALUES (
    test_user_id,
    NOW(),
    NOW(),
    test_user_name,
    test_user_id,
    true,
    null,
    '{}'::jsonb,
    '{}'::jsonb
  )
  ON CONFLICT (id) DO NOTHING;

  -- Inserir na tabela basejump.account_user
  INSERT INTO basejump.account_user (
    account_id,
    user_id,
    account_role
  ) 
  VALUES (
    test_user_id,
    test_user_id,
    'owner'
  )
  ON CONFLICT (account_id, user_id) DO NOTHING;
  
  -- Verificar se a conta foi criada
  RAISE NOTICE 'Account created for user %', test_user_id;
END $$;
*/

-- Versão vazia para não causar erros durante a migração
DO $$ BEGIN NULL; END $$;
