-- Trigger para criar automaticamente contas quando um novo usuário é registrado
-- Este trigger é executado APÓS a inserção na tabela auth.users

-- Primeiro, criamos a função que será chamada pelo trigger
CREATE OR REPLACE FUNCTION public.create_accounts_for_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT;
  user_name TEXT;
BEGIN
  -- Obter o email do usuário
  user_email := NEW.email;
  
  -- Extrair nome do usuário do email
  IF user_email IS NOT NULL THEN
    user_name := split_part(user_email, '@', 1);
  ELSE
    user_name := 'User ' || substr(NEW.id::text, 1, 8);
  END IF;
  
  -- 1. Inserir na tabela public.accounts (necessária para a chave estrangeira threads_account_id_fkey)
  INSERT INTO public.accounts (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  
  -- 2. Tentar inserir na tabela basejump.accounts para manter consistência
  BEGIN
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
      NEW.id,
      NOW(),
      NOW(),
      user_name,
      NEW.id,
      true,
      null,
      '{}'::jsonb,
      '{}'::jsonb
    )
    ON CONFLICT (id) DO NOTHING;
    
    -- 3. Inserir na tabela basejump.account_user
    INSERT INTO basejump.account_user (
      account_id,
      user_id,
      account_role
    ) 
    VALUES (
      NEW.id,
      NEW.id,
      'owner'
    )
    ON CONFLICT (account_id, user_id) DO NOTHING;
    
  EXCEPTION WHEN OTHERS THEN
    -- Ignorar erros na inserção em basejump.accounts
    -- O importante é que a conta exista em public.accounts
    RAISE NOTICE 'Error creating account in basejump schema: %', SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Agora criamos o trigger que chama essa função após a inserção de um novo usuário
DROP TRIGGER IF EXISTS create_accounts_after_user_signup ON auth.users;

CREATE TRIGGER create_accounts_after_user_signup
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.create_accounts_for_new_user();
