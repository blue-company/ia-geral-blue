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

-- Modificar o trigger de criação de contas para também processar os convites e confirmar usuários automaticamente
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
  
  -- Confirmar o usuário automaticamente (sem necessidade de verificação por email)
  BEGIN
    -- Definir email_confirmed_at para o timestamp atual
    UPDATE auth.users
    SET email_confirmed_at = NOW()
    WHERE id = NEW.id AND (email_confirmed_at IS NULL);
    
    RAISE NOTICE 'User % automatically confirmed', NEW.id;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error confirming user %: %', NEW.id, SQLERRM;
  END;
  
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
        LIMIT 1;
        
        IF inviter_id IS NOT NULL THEN
          -- Marcar o convite como utilizado (mesmo que já tenha sido usado antes)
          UPDATE public.user_invites ui
          SET 
            used = TRUE,
            used_at = COALESCE(ui.used_at, NOW()),
            used_by = COALESCE(ui.used_by, NEW.id),
            updated_at = NOW()
          WHERE ui.invite_code::TEXT = invite_code::TEXT
          AND inviter_id IS NOT NULL;
          
          -- Incrementar o contador de convites utilizados para o usuário que convidou
          UPDATE public.user_invites ui
          SET used_count = COALESCE(ui.used_count, 0) + 1
          WHERE ui.inviter_id = inviter_id
          AND ui.invite_code::TEXT = invite_code::TEXT;
          
          -- Adicionar um prompt extra ao limite diário do usuário que criou o convite
          -- Garantir que o usuário receba o bônus para todas as datas futuras
          DECLARE
            current_date_str TEXT;
            inviter_usage_record RECORD;
            bonus_prompts INTEGER;
          BEGIN
            current_date_str := CURRENT_DATE::TEXT;
            
            -- Calcular o número total de convites utilizados para este usuário
            SELECT COUNT(*) INTO bonus_prompts
            FROM public.user_invites
            WHERE inviter_id = inviter_id
            AND used = TRUE;
            
            -- Garantir que o bonus_count seja pelo menos igual ao número de convites utilizados
            SELECT * INTO inviter_usage_record
            FROM public.prompt_usage
            WHERE user_id = inviter_id
            AND date = CURRENT_DATE;
            
            IF inviter_usage_record IS NULL THEN
              -- Criar novo registro com bonus_count igual ao número de convites utilizados
              INSERT INTO public.prompt_usage (user_id, date, count, bonus_count)
              VALUES (inviter_id, CURRENT_DATE, 0, GREATEST(1, bonus_prompts));
            ELSE
              -- Atualizar o bonus_count no registro existente para ser pelo menos igual ao número de convites utilizados
              UPDATE public.prompt_usage
              SET bonus_count = GREATEST(COALESCE(bonus_count, 0) + 1, bonus_prompts)
              WHERE user_id = inviter_id
              AND date = CURRENT_DATE;
            END IF;
            
            RAISE NOTICE 'Added bonus prompt to inviter %. Total bonus: %', inviter_id, bonus_prompts;
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
  existing_record RECORD;
BEGIN
  -- Calcular o número de bônus de prompts com base nos convites utilizados
  SELECT COUNT(*) INTO bonus_prompts
  FROM public.user_invites
  WHERE inviter_id = p_user_id
  AND used = TRUE;
  
  -- Verificar se já existe um registro para o usuário na data atual
  SELECT * INTO existing_record
  FROM public.prompt_usage
  WHERE user_id = p_user_id AND date = today;
  
  IF existing_record IS NULL THEN
    -- Inserir um novo registro com contagem 0 e o bônus calculado
    INSERT INTO public.prompt_usage (user_id, date, count, bonus_count)
    VALUES (p_user_id, today, 0, GREATEST(0, bonus_prompts));
    
    RAISE NOTICE 'Created new prompt usage record for user % with % bonus prompts', p_user_id, bonus_prompts;
  ELSE
    -- Atualizar o bonus_count no registro existente para ser pelo menos igual ao número de convites utilizados
    UPDATE public.prompt_usage
    SET bonus_count = GREATEST(COALESCE(existing_record.bonus_count, 0), bonus_prompts)
    WHERE user_id = p_user_id AND date = today;
    
    RAISE NOTICE 'Updated prompt usage record for user % with % bonus prompts', p_user_id, GREATEST(COALESCE(existing_record.bonus_count, 0), bonus_prompts);
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
  bonus_count INTEGER := 0;
BEGIN
  -- Primeiro, confirmar todos os usuários que ainda não foram confirmados
  UPDATE auth.users
  SET email_confirmed_at = NOW()
  WHERE email_confirmed_at IS NULL;
  
  RAISE NOTICE 'Confirmed all pending users';
  
  -- Depois, inicializar os registros de prompt_usage para todos os usuários
  FOR user_record IN SELECT id FROM auth.users
  LOOP
    -- Chamar a função ensure_prompt_usage_record para cada usuário
    BEGIN
      PERFORM public.ensure_prompt_usage_record(user_record.id);
      processed_count := processed_count + 1;
      
      -- Verificar se o usuário tem convites utilizados
      SELECT COUNT(*) INTO bonus_count
      FROM public.user_invites
      WHERE inviter_id = user_record.id
      AND used = TRUE;
      
      IF bonus_count > 0 THEN
        RAISE NOTICE 'User % has % bonus prompts from invites', user_record.id, bonus_count;
      END IF;
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

-- Remover o trigger existente se houver
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Criar o trigger para executar a função após a criação de um novo usuário
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_accounts_for_new_user();
