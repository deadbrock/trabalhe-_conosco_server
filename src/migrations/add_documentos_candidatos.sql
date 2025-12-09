-- Migração: Adicionar campos de documentos na tabela candidatos
-- Data: 09/12/2025
-- Objetivo: Armazenar URLs dos documentos aprovados para envio ao FGS

ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS foto_url TEXT;
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS ctps_url TEXT;
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS rg_frente_url TEXT;
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS rg_verso_url TEXT;
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS comprovante_residencia_url TEXT;
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS titulo_eleitor_url TEXT;
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS certidao_nascimento_url TEXT;
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS reservista_url TEXT;
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS antecedentes_criminais_url TEXT;
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS certidao_dependente_url TEXT;
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS cpf_dependente_url TEXT;

-- Comentários para documentação
COMMENT ON COLUMN candidatos.foto_url IS 'URL da foto 3x4 (enviada ao FGS)';
COMMENT ON COLUMN candidatos.ctps_url IS 'URL da CTPS Digital (enviada ao FGS)';
COMMENT ON COLUMN candidatos.rg_frente_url IS 'URL do RG frente (enviada ao FGS)';
COMMENT ON COLUMN candidatos.rg_verso_url IS 'URL do RG verso (enviada ao FGS)';
COMMENT ON COLUMN candidatos.comprovante_residencia_url IS 'URL do comprovante de residência (enviada ao FGS)';
COMMENT ON COLUMN candidatos.titulo_eleitor_url IS 'URL do título de eleitor (enviada ao FGS)';
COMMENT ON COLUMN candidatos.certidao_nascimento_url IS 'URL da certidão de nascimento/casamento (enviada ao FGS)';
COMMENT ON COLUMN candidatos.reservista_url IS 'URL do certificado de reservista (enviada ao FGS)';
COMMENT ON COLUMN candidatos.antecedentes_criminais_url IS 'URL dos antecedentes criminais (enviada ao FGS)';
COMMENT ON COLUMN candidatos.certidao_dependente_url IS 'URL da certidão de nascimento do dependente (enviada ao FGS)';
COMMENT ON COLUMN candidatos.cpf_dependente_url IS 'URL do CPF do dependente (enviada ao FGS)';

