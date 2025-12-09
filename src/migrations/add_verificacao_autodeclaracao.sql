-- Migração: Adicionar campos de verificação para autodeclaração racial
-- Data: 09/12/2025
-- Objetivo: Garantir validade jurídica da autodeclaração com dados de rastreabilidade

-- Adicionar campos de verificação na tabela documentos_candidatos
ALTER TABLE documentos_candidatos
ADD COLUMN IF NOT EXISTS autodeclaracao_ip VARCHAR(45),
ADD COLUMN IF NOT EXISTS autodeclaracao_user_agent TEXT,
ADD COLUMN IF NOT EXISTS autodeclaracao_hash VARCHAR(64),
ADD COLUMN IF NOT EXISTS autodeclaracao_aceite_termos BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS autodeclaracao_aceite_data TIMESTAMP;

-- Criar índice para busca rápida por hash
CREATE INDEX IF NOT EXISTS idx_autodeclaracao_hash ON documentos_candidatos(autodeclaracao_hash);

-- Comentários para documentação
COMMENT ON COLUMN documentos_candidatos.autodeclaracao_ip IS 'Endereço IP do dispositivo usado para fazer a declaração';
COMMENT ON COLUMN documentos_candidatos.autodeclaracao_user_agent IS 'Navegador/dispositivo usado para fazer a declaração';
COMMENT ON COLUMN documentos_candidatos.autodeclaracao_hash IS 'Hash SHA-256 único para verificação de autenticidade do documento';
COMMENT ON COLUMN documentos_candidatos.autodeclaracao_aceite_termos IS 'Confirmação de que o candidato aceitou os termos legais';
COMMENT ON COLUMN documentos_candidatos.autodeclaracao_aceite_data IS 'Data/hora em que o candidato aceitou os termos';

