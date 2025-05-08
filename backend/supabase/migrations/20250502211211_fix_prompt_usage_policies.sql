-- Adicionar políticas mais específicas para prompt_usage
DROP POLICY IF EXISTS "Users can read their own prompt usage" ON prompt_usage;
DROP POLICY IF EXISTS "Service role can manage all prompt usage" ON prompt_usage;

-- Políticas específicas por operação
CREATE POLICY "Users can read their own prompt usage"
  ON prompt_usage FOR SELECT
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert their own prompt usage"
  ON prompt_usage FOR INSERT
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update their own prompt usage"
  ON prompt_usage FOR UPDATE
  USING (auth.uid()::text = user_id::text);

-- Política para o service role
CREATE POLICY "Service role can manage all prompt usage"
  ON prompt_usage
  USING (auth.role() = 'service_role');

-- Garantir que a tabela tenha a extensão uuid-ossp
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
