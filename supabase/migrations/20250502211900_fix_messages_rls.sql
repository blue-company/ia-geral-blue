-- Corrigir políticas RLS para a tabela messages

-- Habilitar RLS na tabela messages se ainda não estiver habilitado
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes para evitar conflitos
DROP POLICY IF EXISTS "Users can view messages in their threads" ON messages;
DROP POLICY IF EXISTS "Users can insert messages in their threads" ON messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON messages;
DROP POLICY IF EXISTS "Service role can manage all messages" ON messages;

-- Criar políticas específicas por operação
CREATE POLICY "Users can view messages in their threads"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM threads
      WHERE threads.thread_id = messages.thread_id
      AND threads.account_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages in their threads"
  ON messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM threads
      WHERE threads.thread_id = messages.thread_id
      AND threads.account_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own messages"
  ON messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM threads
      WHERE threads.thread_id = messages.thread_id
      AND threads.account_id = auth.uid()
    )
  );

-- Política para o service role
CREATE POLICY "Service role can manage all messages"
  ON messages
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Garantir que o service role possa fazer qualquer operação
CREATE POLICY "Service role can do anything with messages"
  ON messages
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
