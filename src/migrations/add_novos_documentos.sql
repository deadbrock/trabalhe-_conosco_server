-- Adicionar novos campos de documentos na tabela documentos_candidatos

-- Foto 3x4
ALTER TABLE documentos_candidatos ADD COLUMN IF NOT EXISTS foto_3x4_url TEXT;
ALTER TABLE documentos_candidatos ADD COLUMN IF NOT EXISTS foto_3x4_validado BOOLEAN DEFAULT false;
ALTER TABLE documentos_candidatos ADD COLUMN IF NOT EXISTS foto_3x4_rejeitado BOOLEAN DEFAULT false;
ALTER TABLE documentos_candidatos ADD COLUMN IF NOT EXISTS foto_3x4_motivo_rejeicao TEXT;

-- Certidão de Nascimento do Dependente
ALTER TABLE documentos_candidatos ADD COLUMN IF NOT EXISTS certidao_nascimento_dependente_url TEXT;
ALTER TABLE documentos_candidatos ADD COLUMN IF NOT EXISTS certidao_nascimento_dependente_validado BOOLEAN DEFAULT false;
ALTER TABLE documentos_candidatos ADD COLUMN IF NOT EXISTS certidao_nascimento_dependente_rejeitado BOOLEAN DEFAULT false;
ALTER TABLE documentos_candidatos ADD COLUMN IF NOT EXISTS certidao_nascimento_dependente_motivo_rejeicao TEXT;

-- CPF do Dependente
ALTER TABLE documentos_candidatos ADD COLUMN IF NOT EXISTS cpf_dependente_url TEXT;
ALTER TABLE documentos_candidatos ADD COLUMN IF NOT EXISTS cpf_dependente_validado BOOLEAN DEFAULT false;
ALTER TABLE documentos_candidatos ADD COLUMN IF NOT EXISTS cpf_dependente_rejeitado BOOLEAN DEFAULT false;
ALTER TABLE documentos_candidatos ADD COLUMN IF NOT EXISTS cpf_dependente_motivo_rejeicao TEXT;

-- Comentários
COMMENT ON COLUMN documentos_candidatos.foto_3x4_url IS 'Foto 3x4 do candidato';
COMMENT ON COLUMN documentos_candidatos.certidao_nascimento_dependente_url IS 'Certidão de nascimento do dependente (filho até 13 anos)';
COMMENT ON COLUMN documentos_candidatos.cpf_dependente_url IS 'CPF do dependente (filho até 13 anos)';

