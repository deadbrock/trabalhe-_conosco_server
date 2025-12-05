-- Adicionar campos de autodeclaração racial

-- Na tabela de documentos
ALTER TABLE documentos_candidatos ADD COLUMN IF NOT EXISTS autodeclaracao_racial VARCHAR(50);
ALTER TABLE documentos_candidatos ADD COLUMN IF NOT EXISTS autodeclaracao_data TIMESTAMP;

-- Na tabela de candidatos
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS autodeclaracao_racial VARCHAR(50);

-- Comentários
COMMENT ON COLUMN documentos_candidatos.autodeclaracao_racial IS 'Autodeclaração racial do candidato (branca, preta, parda, amarela, indigena, nao_declarar)';
COMMENT ON COLUMN documentos_candidatos.autodeclaracao_data IS 'Data/hora em que a autodeclaração foi preenchida';
COMMENT ON COLUMN candidatos.autodeclaracao_racial IS 'Autodeclaração racial do candidato';

