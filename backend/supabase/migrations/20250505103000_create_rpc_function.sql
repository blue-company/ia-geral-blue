-- Criar uma função RPC para inserir contas em basejump.accounts
CREATE OR REPLACE FUNCTION basejump.create_account_for_user(
  user_id UUID,
  user_name TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
    user_id,
    NOW(),
    NOW(),
    user_name,
    user_id,
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
    user_id,
    user_id,
    'owner'
  )
  ON CONFLICT (account_id, user_id) DO NOTHING;
END;
$$;

-- Conceder permissão para executar a função
GRANT EXECUTE ON FUNCTION basejump.create_account_for_user TO authenticated;
GRANT EXECUTE ON FUNCTION basejump.create_account_for_user TO anon;
GRANT EXECUTE ON FUNCTION basejump.create_account_for_user TO service_role;
