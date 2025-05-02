-- Corrigir problema de formato de UUID nas tabelas

-- Remover a restrição existente se existir
ALTER TABLE IF EXISTS projects DROP CONSTRAINT IF EXISTS projects_account_id_fkey;

-- Adicionar uma nova restrição
ALTER TABLE projects ADD CONSTRAINT projects_account_id_fkey 
  FOREIGN KEY (account_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  
-- Criar função para normalizar o formato do UUID antes da inserção
CREATE OR REPLACE FUNCTION normalize_uuid_before_insert()
RETURNS TRIGGER AS $func$
BEGIN
  -- Tentar converter para UUID e depois de volta para texto para normalizar o formato
  BEGIN
    NEW.account_id = uuid(NEW.account_id)::text;
  EXCEPTION WHEN OTHERS THEN
    -- Se falhar, manter o valor original
    RAISE NOTICE 'Could not normalize UUID format for %', NEW.account_id;
  END;
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

-- Aplicar o trigger à tabela projects
DROP TRIGGER IF EXISTS normalize_uuid_projects ON projects;
CREATE TRIGGER normalize_uuid_projects
  BEFORE INSERT OR UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION normalize_uuid_before_insert();
