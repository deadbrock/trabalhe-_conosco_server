-- Tabela para credenciais temporárias de acesso aos documentos
CREATE TABLE IF NOT EXISTS credenciais_temporarias (
  id SERIAL PRIMARY KEY,
  candidato_id INTEGER NOT NULL REFERENCES candidatos(id) ON DELETE CASCADE,
  cpf VARCHAR(11) NOT NULL,
  senha VARCHAR(7) NOT NULL,
  ativo BOOLEAN DEFAULT true,
  expira_em TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(cpf, senha)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_credenciais_cpf ON credenciais_temporarias(cpf);
CREATE INDEX IF NOT EXISTS idx_credenciais_candidato ON credenciais_temporarias(candidato_id);
CREATE INDEX IF NOT EXISTS idx_credenciais_ativo ON credenciais_temporarias(ativo);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_credenciais_temporarias_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_credenciais_temporarias_updated_at ON credenciais_temporarias;
CREATE TRIGGER trigger_update_credenciais_temporarias_updated_at
  BEFORE UPDATE ON credenciais_temporarias
  FOR EACH ROW
  EXECUTE FUNCTION update_credenciais_temporarias_updated_at();

-- Comentários
COMMENT ON TABLE credenciais_temporarias IS 'Credenciais temporárias para acesso ao sistema de envio de documentos';
COMMENT ON COLUMN credenciais_temporarias.cpf IS 'CPF do candidato (sem formatação)';
COMMENT ON COLUMN credenciais_temporarias.senha IS 'Senha temporária de 7 caracteres';
COMMENT ON COLUMN credenciais_temporarias.ativo IS 'Se a credencial ainda está ativa';
COMMENT ON COLUMN credenciais_temporarias.expira_em IS 'Data de expiração da credencial';

