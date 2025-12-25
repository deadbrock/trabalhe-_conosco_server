-- Adicionar campos de perfil aos usuários RH
-- Executar: npm run migrate

-- Verificar se as colunas já existem antes de adicionar
DO $$ 
BEGIN
  -- Adicionar coluna foto_perfil se não existir
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='usuarios' AND column_name='foto_perfil') THEN
    ALTER TABLE usuarios ADD COLUMN foto_perfil TEXT;
    RAISE NOTICE 'Coluna foto_perfil adicionada';
  END IF;

  -- Adicionar coluna telefone se não existir
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='usuarios' AND column_name='telefone') THEN
    ALTER TABLE usuarios ADD COLUMN telefone VARCHAR(20);
    RAISE NOTICE 'Coluna telefone adicionada';
  END IF;

  -- Adicionar coluna cargo se não existir
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='usuarios' AND column_name='cargo') THEN
    ALTER TABLE usuarios ADD COLUMN cargo VARCHAR(100);
    RAISE NOTICE 'Coluna cargo adicionada';
  END IF;

  -- Adicionar coluna data_atualizacao se não existir
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='usuarios' AND column_name='data_atualizacao') THEN
    ALTER TABLE usuarios ADD COLUMN data_atualizacao TIMESTAMP DEFAULT NOW();
    RAISE NOTICE 'Coluna data_atualizacao adicionada';
  END IF;
END $$;

-- Criar índice para busca por email (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_usuarios_email') THEN
    CREATE INDEX idx_usuarios_email ON usuarios(email);
    RAISE NOTICE 'Índice idx_usuarios_email criado';
  END IF;
END $$;

COMMENT ON COLUMN usuarios.foto_perfil IS 'URL da foto de perfil do usuário (Cloudinary)';
COMMENT ON COLUMN usuarios.telefone IS 'Telefone de contato do usuário RH';
COMMENT ON COLUMN usuarios.cargo IS 'Cargo/função do usuário RH';
COMMENT ON COLUMN usuarios.data_atualizacao IS 'Data da última atualização do perfil';

