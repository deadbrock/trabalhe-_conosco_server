import { pool } from "./db";

async function migrateDocumentos() {
  const client = await pool.connect();
  try {
    console.log("🔧 Iniciando migration: tabela documentos_admissao...");

    await client.query("BEGIN");

    await client.query(`
      CREATE TABLE IF NOT EXISTS documentos_admissao (
        id                                     SERIAL PRIMARY KEY,
        candidato_id                           INTEGER REFERENCES candidatos(id) ON DELETE CASCADE,
        status                                 TEXT NOT NULL DEFAULT 'pendente',
        token_acesso                           TEXT UNIQUE,
        senha_hash                             TEXT,
        data_envio_link                        TIMESTAMPTZ,
        data_ultimo_upload                     TIMESTAMPTZ,
        data_conclusao                         TIMESTAMPTZ,
        criado_em                              TIMESTAMPTZ DEFAULT NOW(),

        -- Autodeclaração racial
        autodeclaracao_racial                  TEXT,
        autodeclaracao_data                    TIMESTAMPTZ,
        autodeclaracao_ip                      TEXT,
        autodeclaracao_user_agent              TEXT,
        autodeclaracao_hash                    TEXT,
        autodeclaracao_aceite_termos           BOOLEAN DEFAULT FALSE,
        autodeclaracao_aceite_data             TIMESTAMPTZ,

        -- Documentos (url + validado + rejeitado + motivo)
        foto_3x4_url                           TEXT,
        foto_3x4_validado                      BOOLEAN DEFAULT FALSE,
        foto_3x4_rejeitado                     BOOLEAN DEFAULT FALSE,
        foto_3x4_motivo_rejeicao               TEXT,

        ctps_digital_url                       TEXT,
        ctps_digital_validado                  BOOLEAN DEFAULT FALSE,
        ctps_digital_rejeitado                 BOOLEAN DEFAULT FALSE,
        ctps_digital_motivo_rejeicao           TEXT,

        identidade_frente_url                  TEXT,
        identidade_frente_validado             BOOLEAN DEFAULT FALSE,
        identidade_frente_rejeitado            BOOLEAN DEFAULT FALSE,
        identidade_frente_motivo_rejeicao      TEXT,

        identidade_verso_url                   TEXT,
        identidade_verso_validado              BOOLEAN DEFAULT FALSE,
        identidade_verso_rejeitado             BOOLEAN DEFAULT FALSE,
        identidade_verso_motivo_rejeicao       TEXT,

        comprovante_residencia_url             TEXT,
        comprovante_residencia_validado        BOOLEAN DEFAULT FALSE,
        comprovante_residencia_rejeitado       BOOLEAN DEFAULT FALSE,
        comprovante_residencia_motivo_rejeicao TEXT,
        comprovante_residencia_data_emissao    DATE,

        certidao_nascimento_casamento_url             TEXT,
        certidao_nascimento_casamento_validado        BOOLEAN DEFAULT FALSE,
        certidao_nascimento_casamento_rejeitado       BOOLEAN DEFAULT FALSE,
        certidao_nascimento_casamento_motivo_rejeicao TEXT,

        reservista_url                         TEXT,
        reservista_validado                    BOOLEAN DEFAULT FALSE,
        reservista_rejeitado                   BOOLEAN DEFAULT FALSE,
        reservista_motivo_rejeicao             TEXT,

        titulo_eleitor_url                     TEXT,
        titulo_eleitor_validado                BOOLEAN DEFAULT FALSE,
        titulo_eleitor_rejeitado               BOOLEAN DEFAULT FALSE,
        titulo_eleitor_motivo_rejeicao         TEXT,

        antecedentes_criminais_url             TEXT,
        antecedentes_criminais_validado        BOOLEAN DEFAULT FALSE,
        antecedentes_criminais_rejeitado       BOOLEAN DEFAULT FALSE,
        antecedentes_criminais_motivo_rejeicao TEXT,

        certidao_nascimento_dependente_url             TEXT,
        certidao_nascimento_dependente_validado        BOOLEAN DEFAULT FALSE,
        certidao_nascimento_dependente_rejeitado       BOOLEAN DEFAULT FALSE,
        certidao_nascimento_dependente_motivo_rejeicao TEXT,

        cpf_dependente_url                     TEXT,
        cpf_dependente_validado                BOOLEAN DEFAULT FALSE,
        cpf_dependente_rejeitado               BOOLEAN DEFAULT FALSE,
        cpf_dependente_motivo_rejeicao         TEXT
      );
    `);

    console.log("  ✅ Tabela documentos_admissao criada (ou já existia)");

    await client.query("COMMIT");
    console.log("✅ Migration documentos concluída.\n");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Erro na migration:", err);
    process.exitCode = 1;
  } finally {
    client.release();
    process.exit();
  }
}

migrateDocumentos();
