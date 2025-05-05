-- Modificar a função create_accounts_for_new_user para também inicializar o uso de prompts
CREATE OR REPLACE FUNCTION public.create_accounts_for_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT;
  user_name TEXT;
  current_date DATE;
BEGIN
  -- Obter o email do usuário
  user_email := NEW.email;
  
  -- Extrair nome do usuário do email
  IF user_email IS NOT NULL THEN
    user_name := split_part(user_email, '@', 1);
  ELSE
    user_name := 'User ' || substr(NEW.id::text, 1, 8);
  END IF;
  
  -- 1. Inserir na tabela public.accounts (necessária para a chave estrangeira)
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
  
  -- 4. Inicializar o uso de prompts para o novo usuário
  BEGIN
    INSERT INTO public.prompt_usage (
      user_id,
      date,
      count
    )
    VALUES (
      NEW.id,
      CURRENT_DATE,
      0
    )
    ON CONFLICT (user_id, date) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error initializing prompt usage: %', SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Também criar uma função RPC para garantir que exista um registro de uso de prompts para o dia atual
CREATE OR REPLACE FUNCTION public.ensure_prompt_usage_record(
  p_user_id UUID
)
RETURNS VOID AS $$
DECLARE
  today DATE;
BEGIN
  -- Verificar se já existe um registro para o usuário na data atual
  today := CURRENT_DATE;
  
  IF NOT EXISTS (
    SELECT 1 FROM public.prompt_usage
    WHERE user_id = p_user_id AND date = today
  ) THEN
    -- Inserir um novo registro com contagem 0
    INSERT INTO public.prompt_usage (user_id, date, count)
    VALUES (p_user_id, today, 0);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Conceder permissão para executar a função
GRANT EXECUTE ON FUNCTION public.ensure_prompt_usage_record TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_prompt_usage_record TO anon;
GRANT EXECUTE ON FUNCTION public.ensure_prompt_usage_record TO service_role;
