-- Corrigir as políticas RLS para a tabela projects

-- Verificar se a tabela projects existe
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'projects') THEN
    -- Habilitar RLS na tabela projects se ainda não estiver habilitado
    ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
    
    -- Remover políticas existentes para evitar conflitos
    DROP POLICY IF EXISTS "Users can view their own projects" ON projects;
    DROP POLICY IF EXISTS "Users can insert their own projects" ON projects;
    DROP POLICY IF EXISTS "Users can update their own projects" ON projects;
    DROP POLICY IF EXISTS "Service role can manage all projects" ON projects;
    
    -- Criar políticas específicas por operação
    CREATE POLICY "Users can view their own projects"
      ON projects FOR SELECT
      USING (auth.uid()::text = account_id::text);
      
    CREATE POLICY "Users can insert their own projects"
      ON projects FOR INSERT
      WITH CHECK (auth.uid()::text = account_id::text);
      
    CREATE POLICY "Users can update their own projects"
      ON projects FOR UPDATE
      USING (auth.uid()::text = account_id::text);
      
    -- Política para o service role
    CREATE POLICY "Service role can manage all projects"
      ON projects
      USING (auth.role() = 'service_role');
  END IF;
END $$;
