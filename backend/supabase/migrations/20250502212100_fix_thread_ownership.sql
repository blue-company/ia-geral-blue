-- Corrigir a propriedade dos threads para garantir que os usuários tenham acesso

-- Criar uma view para visualizar threads e seus proprietários
CREATE OR REPLACE VIEW thread_ownership AS
SELECT 
  t.thread_id,
  t.account_id AS thread_account_id,
  p.account_id AS project_account_id
FROM 
  threads t
LEFT JOIN 
  projects p ON t.project_id = p.project_id;

-- Atualizar threads para usar o mesmo account_id do projeto associado
UPDATE threads
SET account_id = p.account_id
FROM projects p
WHERE threads.project_id = p.project_id
AND (threads.account_id IS NULL OR threads.account_id != p.account_id);

-- Garantir que todos os threads tenham um account_id
UPDATE threads
SET account_id = (
  SELECT id FROM auth.users 
  ORDER BY created_at ASC 
  LIMIT 1
)
WHERE account_id IS NULL;

-- Adicionar um trigger para garantir que novos threads sempre tenham o account_id correto
CREATE OR REPLACE FUNCTION ensure_thread_account_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o account_id não foi especificado, use o account_id do projeto
  IF NEW.account_id IS NULL AND NEW.project_id IS NOT NULL THEN
    SELECT account_id INTO NEW.account_id
    FROM projects
    WHERE project_id = NEW.project_id;
  END IF;
  
  -- Se ainda não tiver account_id, use o ID do usuário atual
  IF NEW.account_id IS NULL THEN
    NEW.account_id = auth.uid();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar o trigger à tabela threads
DROP TRIGGER IF EXISTS ensure_thread_account_id_trigger ON threads;
CREATE TRIGGER ensure_thread_account_id_trigger
  BEFORE INSERT OR UPDATE ON threads
  FOR EACH ROW
  EXECUTE FUNCTION ensure_thread_account_id();
