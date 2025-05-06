-- Migração para melhorar a segurança da tabela prompt_usage
-- Esta migração adiciona políticas de segurança mais restritivas para evitar que usuários
-- possam modificar diretamente sua contagem de prompts ou bônus

-- 1. Remover políticas existentes que possam ser muito permissivas
DROP POLICY IF EXISTS "Users can read their own prompt usage" ON prompt_usage;
DROP POLICY IF EXISTS "Service role can manage all prompt usage" ON prompt_usage;
DROP POLICY IF EXISTS "Users can update their own prompt usage" ON prompt_usage;
DROP POLICY IF EXISTS "Users can insert their own prompt usage" ON prompt_usage;

-- 2. Criar políticas mais restritivas
-- Permitir que usuários apenas LEIAM seus próprios registros de uso
CREATE POLICY "Users can read their own prompt usage"
  ON prompt_usage FOR SELECT
  USING (auth.uid() = user_id);

-- Permitir que apenas o service_role possa inserir, atualizar ou excluir registros
CREATE POLICY "Service role can manage all prompt usage"
  ON prompt_usage
  USING (auth.jwt() ->> 'role' = 'service_role');

-- 3. Remover as funções existentes para evitar conflitos de parâmetros
DROP FUNCTION IF EXISTS ensure_prompt_usage_record(UUID);
DROP FUNCTION IF EXISTS increment_prompt_count(UUID);
DROP FUNCTION IF EXISTS get_prompt_usage(UUID);

-- 4. Adicionar uma função RPC segura para inicializar registros de uso
CREATE FUNCTION ensure_prompt_usage_record(p_user_id UUID)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  current_date_val DATE := CURRENT_DATE;
  bonus_count_val INT := 0;
  invites_count INT := 0;
BEGIN
  -- Verificar se já existe um registro para hoje
  PERFORM 1 FROM prompt_usage
  WHERE user_id = p_user_id AND date = current_date_val;
  
  -- Se não existir, criar um novo
  IF NOT FOUND THEN
    -- Contar convites utilizados para calcular o bonus_count
    SELECT COUNT(*) INTO invites_count
    FROM user_invites
    WHERE inviter_id = p_user_id AND used = TRUE AND used_by IS NOT NULL;
    
    -- Inserir novo registro com bonus_count baseado nos convites utilizados
    INSERT INTO prompt_usage (user_id, date, count, bonus_count)
    VALUES (p_user_id, current_date_val, 0, invites_count);
  END IF;
END;
$$;

-- 4. Adicionar uma função RPC segura para incrementar a contagem de prompts
CREATE FUNCTION increment_prompt_count(p_user_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  current_date_val DATE := CURRENT_DATE;
  current_count INT;
  max_count INT := 6; -- Limite base de prompts por dia
  bonus_count_val INT := 0;
  total_allowed INT;
BEGIN
  -- Garantir que exista um registro para hoje
  PERFORM ensure_prompt_usage_record(p_user_id);
  
  -- Obter a contagem atual e o bônus
  SELECT count, COALESCE(bonus_count, 0) INTO current_count, bonus_count_val
  FROM prompt_usage
  WHERE user_id = p_user_id AND date = current_date_val;
  
  -- Calcular o limite total permitido
  total_allowed := max_count + bonus_count_val;
  
  -- Verificar se o usuário já atingiu o limite
  IF current_count >= total_allowed THEN
    RETURN FALSE;
  END IF;
  
  -- Incrementar a contagem
  UPDATE prompt_usage
  SET count = count + 1, updated_at = NOW()
  WHERE user_id = p_user_id AND date = current_date_val;
  
  RETURN TRUE;
END;
$$;

-- 5. Adicionar uma função RPC segura para obter o uso de prompts
CREATE FUNCTION get_prompt_usage(p_user_id UUID)
RETURNS TABLE (
  count INT,
  bonus_count INT,
  max_allowed INT,
  remaining INT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  current_date_val DATE := CURRENT_DATE;
  base_limit INT := 6; -- Limite base de prompts por dia
  current_count INT := 0;
  bonus_count_val INT := 0;
  total_allowed INT;
  today_invites INT := 0; -- Variável para armazenar convites do dia
BEGIN
  -- Garantir que exista um registro para hoje
  PERFORM ensure_prompt_usage_record(p_user_id);
  
  -- Obter a contagem atual e o bônus
  SELECT pu.count, COALESCE(pu.bonus_count, 0) INTO current_count, bonus_count_val
  FROM prompt_usage pu
  WHERE pu.user_id = p_user_id AND pu.date = current_date_val;
  
  -- Verificar também convites válidos realizados no dia que ainda não foram contabilizados
  
  -- Contar convites válidos realizados no dia
  SELECT COUNT(*) INTO today_invites
  FROM user_invites ui
  WHERE ui.inviter_id = p_user_id 
    AND ui.used = TRUE 
    AND ui.used_by IS NOT NULL
    AND DATE(ui.used_at) = current_date_val
    AND (ui.created_at >= (current_date_val || ' 00:00:00')::TIMESTAMP WITH TIME ZONE);
    
  -- Adicionar os convites do dia ao bonus_count se não estiverem já contabilizados
  IF today_invites > 0 THEN
    bonus_count_val := bonus_count_val + today_invites;
    
    -- Atualizar o bonus_count na tabela para refletir os convites recentes
    UPDATE prompt_usage
    SET bonus_count = bonus_count_val, updated_at = NOW()
    WHERE user_id = p_user_id AND date = current_date_val;
  END IF;
  
  -- Calcular o limite total permitido
  total_allowed := base_limit + bonus_count_val;
  
  -- Retornar os resultados
  RETURN QUERY
  SELECT 
    current_count,
    bonus_count_val,
    total_allowed,
    GREATEST(0, total_allowed - current_count);
END;
$$;
