-- Tabela para armazenar documentos dos candidatos aprovados
CREATE TABLE IF NOT EXISTS documentos_candidatos (
  id SERIAL PRIMARY KEY,
  candidato_id INTEGER NOT NULL REFERENCES candidatos(id) ON DELETE CASCADE,
  
  -- Token único para acesso seguro
  token_acesso VARCHAR(255) UNIQUE NOT NULL,
  token_expira_em TIMESTAMP,
  
  -- Documentos obrigatórios
  ctps_digital_url TEXT, -- Carteira de Trabalho Digital
  ctps_digital_validado BOOLEAN DEFAULT false,
  ctps_digital_rejeitado BOOLEAN DEFAULT false,
  ctps_digital_motivo_rejeicao TEXT,
  
  identidade_frente_url TEXT,
  identidade_frente_validado BOOLEAN DEFAULT false,
  identidade_frente_rejeitado BOOLEAN DEFAULT false,
  identidade_frente_motivo_rejeicao TEXT,
  
  identidade_verso_url TEXT,
  identidade_verso_validado BOOLEAN DEFAULT false,
  identidade_verso_rejeitado BOOLEAN DEFAULT false,
  identidade_verso_motivo_rejeicao TEXT,
  
  comprovante_residencia_url TEXT,
  comprovante_residencia_validado BOOLEAN DEFAULT false,
  comprovante_residencia_rejeitado BOOLEAN DEFAULT false,
  comprovante_residencia_motivo_rejeicao TEXT,
  comprovante_residencia_data_emissao DATE, -- Extraída via OCR
  
  certidao_nascimento_casamento_url TEXT,
  certidao_nascimento_casamento_validado BOOLEAN DEFAULT false,
  certidao_nascimento_casamento_rejeitado BOOLEAN DEFAULT false,
  certidao_nascimento_casamento_motivo_rejeicao TEXT,
  
  reservista_url TEXT, -- Apenas masculino
  reservista_validado BOOLEAN DEFAULT false,
  reservista_rejeitado BOOLEAN DEFAULT false,
  reservista_motivo_rejeicao TEXT,
  
  titulo_eleitor_url TEXT,
  titulo_eleitor_validado BOOLEAN DEFAULT false,
  titulo_eleitor_rejeitado BOOLEAN DEFAULT false,
  titulo_eleitor_motivo_rejeicao TEXT,
  
  antecedentes_criminais_url TEXT,
  antecedentes_criminais_validado BOOLEAN DEFAULT false,
  antecedentes_criminais_rejeitado BOOLEAN DEFAULT false,
  antecedentes_criminais_motivo_rejeicao TEXT,
  
  -- Documentos de filhos (JSON array) - opcional
  filhos_documentos JSONB, -- [{nome: "", certidao_url: "", cpf_url: "", idade: 10}]
  
  -- Metadados
  status VARCHAR(50) DEFAULT 'pendente', -- pendente, em_analise, aprovado, rejeitado
  data_envio_link TIMESTAMP DEFAULT NOW(),
  data_primeiro_upload TIMESTAMP,
  data_ultimo_upload TIMESTAMP,
  data_conclusao TIMESTAMP,
  observacoes TEXT,
  
  -- Auditoria
  ip_upload VARCHAR(100),
  user_agent TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_documentos_candidatos_candidato_id ON documentos_candidatos(candidato_id);
CREATE INDEX IF NOT EXISTS idx_documentos_candidatos_token_acesso ON documentos_candidatos(token_acesso);
CREATE INDEX IF NOT EXISTS idx_documentos_candidatos_status ON documentos_candidatos(status);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_documentos_candidatos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_documentos_candidatos_updated_at
  BEFORE UPDATE ON documentos_candidatos
  FOR EACH ROW
  EXECUTE FUNCTION update_documentos_candidatos_updated_at();

-- Comentários
COMMENT ON TABLE documentos_candidatos IS 'Armazena documentos dos candidatos aprovados para admissão';
COMMENT ON COLUMN documentos_candidatos.token_acesso IS 'Token único e seguro para acesso sem login';
COMMENT ON COLUMN documentos_candidatos.comprovante_residencia_data_emissao IS 'Data extraída via OCR do comprovante (deve ser < 3 meses)';
COMMENT ON COLUMN documentos_candidatos.filhos_documentos IS 'JSON array com documentos de filhos até 13 anos';

