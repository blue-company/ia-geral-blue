-- Corrigir as políticas RLS para a tabela threads

-- Verificar se a tabela threads existe
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'threads') THEN
    -- Habilitar RLS na tabela threads se ainda não estiver habilitado
    ALTER TABLE threads ENABLE ROW LEVEL SECURITY;
    
    -- Remover políticas existentes para evitar conflitos
    DROP POLICY IF EXISTS "Users can view their own threads" ON threads;
    DROP POLICY IF EXISTS "Users can insert their own threads" ON threads;
    DROP POLICY IF EXISTS "Users can update their own threads" ON threads;
    DROP POLICY IF EXISTS "Service role can manage all threads" ON threads;
    
    -- Criar políticas específicas por operação
    CREATE POLICY "Users can view their own threads"
      ON threads FOR SELECT
      USING (auth.uid()::text = account_id::text);
      
    CREATE POLICY "Users can insert their own threads"
      ON threads FOR INSERT
      WITH CHECK (auth.uid()::text = account_id::text);
      
    CREATE POLICY "Users can update their own threads"
      ON threads FOR UPDATE
      USING (auth.uid()::text = account_id::text);
      
    -- Política para o service role
    CREATE POLICY "Service role can manage all threads"
      ON threads
      USING (auth.role() = 'service_role');
  END IF;
END $$;
