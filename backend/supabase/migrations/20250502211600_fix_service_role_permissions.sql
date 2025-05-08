-- Corrigir permissões para o service_role em todas as tabelas relevantes

-- Garantir que o service_role tenha acesso completo às tabelas
DO $$
DECLARE
  table_name text;
BEGIN
  -- Lista de tabelas que precisam de permissões para o service_role
  FOR table_name IN 
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public' AND 
          tablename IN ('projects', 'threads', 'agent_runs', 'prompt_usage', 'user_invites')
  LOOP
    -- Remover políticas existentes para o service_role
    EXECUTE format('DROP POLICY IF EXISTS "Service role can manage all %s" ON %I', table_name, table_name);
    
    -- Criar uma nova política que permite acesso completo ao service_role
    EXECUTE format('
      CREATE POLICY "Service role can manage all %s" ON %I
      USING (auth.jwt() ->> ''role'' = ''service_role'')
    ', table_name, table_name);
    
    -- Garantir que RLS está habilitado
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
  END LOOP;
END $$;

-- Comentando as operações que exigem permissões de owner do banco de dados
-- Essas operações precisam ser executadas por um usuário com permissões de superuser
-- ou diretamente pelo dashboard do Supabase

-- ALTER TABLE IF EXISTS auth.users ENABLE ROW LEVEL SECURITY;

-- DROP POLICY IF EXISTS "Service role can access all users" ON auth.users;
-- CREATE POLICY "Service role can access all users" ON auth.users
--   USING (auth.jwt() ->> 'role' = 'service_role');
