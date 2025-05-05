-- Migração para garantir que usuários que se cadastram por links de convite
-- também tenham registros inicializados corretamente

-- Adicionar colunas necessárias às tabelas caso ainda não existam
DO $$
BEGIN
  -- Adicionar colunas à tabela user_invites
  -- Adicionar coluna used_at se não existir
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_schema = 'public' AND table_name = 'user_invites' 
                AND column_name = 'used_at') THEN
    ALTER TABLE public.user_invites ADD COLUMN used_at TIMESTAMP WITH TIME ZONE;
  END IF;
  
  -- Adicionar coluna used_by se não existir
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_schema = 'public' AND table_name = 'user_invites' 
                AND column_name = 'used_by') THEN
    ALTER TABLE public.user_invites ADD COLUMN used_by UUID REFERENCES auth.users(id);
  END IF;
  
  -- Adicionar coluna used_count se não existir
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_schema = 'public' AND table_name = 'user_invites' 
                AND column_name = 'used_count') THEN
    ALTER TABLE public.user_invites ADD COLUMN used_count INTEGER NOT NULL DEFAULT 0;
  END IF;
  
  -- Adicionar coluna bonus_count à tabela prompt_usage se não existir
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_schema = 'public' AND table_name = 'prompt_usage' 
                AND column_name = 'bonus_count') THEN
    ALTER TABLE public.prompt_usage ADD COLUMN bonus_count INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Modificar o trigger de criação de contas para também processar os convites
CREATE OR REPLACE FUNCTION public.create_accounts_for_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT;
  user_name TEXT;
  invite_code UUID;
  inviter_id UUID;
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
  
  -- 5. Processar o código de convite, se existir
  BEGIN
    -- Verificar se o usuário foi registrado com um código de convite
    IF NEW.raw_app_meta_data IS NOT NULL AND 
       NEW.raw_app_meta_data::jsonb ? 'invite_code' THEN
      
      -- Extrair o código de convite (converter para UUID)
      DECLARE
        raw_invite_code TEXT;
      BEGIN
        raw_invite_code := NEW.raw_app_meta_data::jsonb->>'invite_code';
        
        -- Verificar se o formato é UUID
        IF raw_invite_code ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
          invite_code := raw_invite_code::UUID;
        ELSE
          RAISE NOTICE 'Invalid UUID format for invite code: %', raw_invite_code;
          invite_code := NULL;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error processing invite code: %', SQLERRM;
        invite_code := NULL;
      END;
      
      IF invite_code IS NOT NULL THEN
        -- Verificar se o código de convite existe na tabela user_invites
        SELECT ui.inviter_id INTO inviter_id
        FROM public.user_invites ui
        WHERE ui.invite_code::TEXT = invite_code::TEXT
        AND (ui.used = FALSE OR ui.used IS NULL)
        LIMIT 1;
        
        IF inviter_id IS NOT NULL THEN
          -- Marcar o convite como utilizado
          UPDATE public.user_invites ui
          SET 
            used = TRUE,
            used_at = NOW(),
            used_by = NEW.id,
            updated_at = NOW()
          WHERE ui.invite_code::TEXT = invite_code::TEXT
          AND (ui.used = FALSE OR ui.used IS NULL);
          
          -- Incrementar o contador de convites utilizados para o usuário que convidou
          UPDATE public.user_invites ui
          SET used_count = COALESCE(ui.used_count, 0) + 1
          WHERE ui.inviter_id = inviter_id;
          
          -- Adicionar um prompt extra ao limite diário do usuário que criou o convite
          -- Primeiro, verificar se já existe um registro para hoje
          DECLARE
            current_date_str TEXT;
            inviter_usage_record RECORD;
          BEGIN
            current_date_str := CURRENT_DATE::TEXT;
            
            SELECT * INTO inviter_usage_record
            FROM public.prompt_usage
            WHERE user_id = inviter_id
            AND date = CURRENT_DATE;
            
            IF inviter_usage_record IS NULL THEN
              -- Criar novo registro com bonus_count = 1
              INSERT INTO public.prompt_usage (user_id, date, count, bonus_count)
              VALUES (inviter_id, CURRENT_DATE, 0, 1);
            ELSE
              -- Incrementar o bonus_count no registro existente
              UPDATE public.prompt_usage
              SET bonus_count = COALESCE(bonus_count, 0) + 1
              WHERE user_id = inviter_id
              AND date = CURRENT_DATE;
            END IF;
          EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Error adding bonus prompt to inviter: %', SQLERRM;
          END;
          
          RAISE NOTICE 'Invite code % processed for user %', invite_code, NEW.id;
        END IF;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error processing invite code: %', SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remover a função existente para evitar erro de parâmetro
DROP FUNCTION IF EXISTS public.ensure_prompt_usage_record(UUID);

-- Criar uma função para garantir que um registro de prompt_usage exista para um usuário
CREATE OR REPLACE FUNCTION public.ensure_prompt_usage_record(p_user_id UUID)
RETURNS void AS $$
DECLARE
  bonus_prompts INTEGER := 0;
  today DATE := CURRENT_DATE;
BEGIN
  -- Calcular o número de bônus de prompts com base nos convites utilizados
  SELECT COUNT(*) INTO bonus_prompts
  FROM public.user_invites
  WHERE inviter_id = p_user_id
  AND used = TRUE;
  
  -- Verificar se já existe um registro para o usuário na data atual
  IF NOT EXISTS (
    SELECT 1 FROM public.prompt_usage
    WHERE user_id = p_user_id AND date = today
  ) THEN
    -- Inserir um novo registro com contagem 0 e o bônus calculado
    INSERT INTO public.prompt_usage (user_id, date, count, bonus_count)
    VALUES (p_user_id, today, 0, bonus_prompts);
  ELSE
    -- Atualizar o bonus_count no registro existente
    UPDATE public.prompt_usage
    SET bonus_count = bonus_prompts
    WHERE user_id = p_user_id AND date = today
    AND (bonus_count IS NULL OR bonus_count < bonus_prompts);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remover a função existente para evitar erros
DROP FUNCTION IF EXISTS public.initialize_prompt_usage_for_all_users();

-- Criar uma função RPC para inicializar registros de prompt_usage para todos os usuários existentes
CREATE OR REPLACE FUNCTION public.initialize_prompt_usage_for_all_users()
RETURNS void AS $$
DECLARE
  user_record RECORD;
  processed_count INTEGER := 0;
BEGIN
  FOR user_record IN SELECT id FROM auth.users
  LOOP
    -- Chamar a função ensure_prompt_usage_record para cada usuário
    BEGIN
      PERFORM public.ensure_prompt_usage_record(user_record.id);
      processed_count := processed_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error processing user %: %', user_record.id, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE 'Processed % users successfully', processed_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Conceder permissão para executar as funções
GRANT EXECUTE ON FUNCTION public.ensure_prompt_usage_record TO service_role;
GRANT EXECUTE ON FUNCTION public.initialize_prompt_usage_for_all_users TO service_role;
