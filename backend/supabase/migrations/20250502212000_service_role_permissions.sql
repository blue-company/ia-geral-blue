-- Garantir que o service_role tenha permissões completas em todas as tabelas

-- Lista de tabelas que precisam de políticas para o service_role
DO $$
DECLARE
  table_name text;
BEGIN
  FOR table_name IN 
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public' AND 
          tablename IN ('projects', 'threads', 'messages', 'agent_runs', 'prompt_usage', 'user_invites', 'sandboxes')
  LOOP
    -- Habilitar RLS na tabela
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    
    -- Remover políticas existentes para o service_role
    EXECUTE format('DROP POLICY IF EXISTS "Service role bypass RLS on %s" ON %I', table_name, table_name);
    
    -- Criar política que permite ao service_role ignorar RLS
    EXECUTE format('
      CREATE POLICY "Service role bypass RLS on %s" ON %I
      FOR ALL
      USING (auth.jwt() ->> ''role'' = ''service_role'')
      WITH CHECK (auth.jwt() ->> ''role'' = ''service_role'')
    ', table_name, table_name);
  END LOOP;
END $$;
