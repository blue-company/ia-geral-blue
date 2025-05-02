-- Corrigir problema de chave estrangeira na tabela threads

-- Verificar se a tabela accounts existe e criar se não existir
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inserir registros de usuários na tabela accounts
INSERT INTO accounts (id)
SELECT id FROM auth.users
WHERE NOT EXISTS (
  SELECT 1 FROM accounts WHERE accounts.id = auth.users.id
);

-- Remover a restrição existente se existir
ALTER TABLE IF EXISTS threads DROP CONSTRAINT IF EXISTS threads_account_id_fkey;

-- Adicionar uma nova restrição para a tabela accounts
ALTER TABLE threads ADD CONSTRAINT threads_account_id_fkey 
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;

-- Criar função para normalizar o formato do UUID antes da inserção
CREATE OR REPLACE FUNCTION normalize_uuid_before_insert_threads()
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

-- Aplicar o trigger à tabela threads
DROP TRIGGER IF EXISTS normalize_uuid_threads ON threads;
CREATE TRIGGER normalize_uuid_threads
  BEFORE INSERT OR UPDATE ON threads
  FOR EACH ROW
  EXECUTE FUNCTION normalize_uuid_before_insert_threads();
