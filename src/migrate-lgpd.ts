/**
 * 🔐 MIGRATION LGPD - Adequação à Lei Geral de Proteção de Dados
 * 
 * Cria:
 * 1. Tabela solicitacoes_lgpd (exportação e exclusão de dados)
 * 2. Campos de consentimento na tabela candidatos
 * 3. Logs e auditoria de exclusões
 */

import { pool } from './db';

async function migrateLGPD() {
  const client = await pool.connect();

  try {
    console.log('🔐 [LGPD] Iniciando migration...\n');

    await client.query('BEGIN');

    // ==========================================
    // 1️⃣ CRIAR TABELA DE SOLICITAÇÕES LGPD
    // ==========================================
    console.log('📋 Criando tabela solicitacoes_lgpd...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS solicitacoes_lgpd (
        id SERIAL PRIMARY KEY,
        candidato_id INT REFERENCES candidatos(id) ON DELETE CASCADE,
        tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('exportacao', 'exclusao')),
        status VARCHAR(50) NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_analise', 'aprovada', 'concluida', 'rejeitada')),
        
        -- Dados da solicitação
        email_solicitante VARCHAR(255) NOT NULL,
        telefone_solicitante VARCHAR(20),
        ip_solicitante VARCHAR(50),
        user_agent TEXT,
        
        -- Validação de identidade
        codigo_verificacao VARCHAR(6),
        codigo_validado BOOLEAN DEFAULT FALSE,
        data_envio_codigo TIMESTAMP,
        data_validacao_codigo TIMESTAMP,
        
        -- Datas e aprovação
        data_solicitacao TIMESTAMP DEFAULT NOW(),
        data_conclusao TIMESTAMP,
        aprovado_por INT REFERENCES usuarios(id),
        motivo_rejeicao TEXT,
        
        -- Comprovante
        comprovante_url TEXT,
        hash_comprovante VARCHAR(64),
        
        -- Observações
        observacoes TEXT,
        
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    console.log('✅ Tabela solicitacoes_lgpd criada\n');

    // ==========================================
    // 2️⃣ ADICIONAR CAMPOS LGPD NA TABELA CANDIDATOS
    // ==========================================
    console.log('📋 Adicionando campos LGPD na tabela candidatos...');
    
    // Verificar se as colunas já existem antes de adicionar
    const checkColumns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'candidatos' 
      AND column_name IN (
        'consentimento_lgpd', 
        'data_consentimento', 
        'ip_consentimento',
        'dados_excluidos',
        'data_exclusao',
        'motivo_exclusao',
        'excluido_por'
      );
    `);

    const existingColumns = checkColumns.rows.map((row: any) => row.column_name);

    if (!existingColumns.includes('consentimento_lgpd')) {
      await client.query(`
        ALTER TABLE candidatos 
        ADD COLUMN consentimento_lgpd BOOLEAN DEFAULT FALSE;
      `);
      console.log('  ✅ Campo consentimento_lgpd adicionado');
    }

    if (!existingColumns.includes('data_consentimento')) {
      await client.query(`
        ALTER TABLE candidatos 
        ADD COLUMN data_consentimento TIMESTAMP;
      `);
      console.log('  ✅ Campo data_consentimento adicionado');
    }

    if (!existingColumns.includes('ip_consentimento')) {
      await client.query(`
        ALTER TABLE candidatos 
        ADD COLUMN ip_consentimento VARCHAR(50);
      `);
      console.log('  ✅ Campo ip_consentimento adicionado');
    }

    if (!existingColumns.includes('dados_excluidos')) {
      await client.query(`
        ALTER TABLE candidatos 
        ADD COLUMN dados_excluidos BOOLEAN DEFAULT FALSE;
      `);
      console.log('  ✅ Campo dados_excluidos adicionado');
    }

    if (!existingColumns.includes('data_exclusao')) {
      await client.query(`
        ALTER TABLE candidatos 
        ADD COLUMN data_exclusao TIMESTAMP;
      `);
      console.log('  ✅ Campo data_exclusao adicionado');
    }

    if (!existingColumns.includes('motivo_exclusao')) {
      await client.query(`
        ALTER TABLE candidatos 
        ADD COLUMN motivo_exclusao TEXT;
      `);
      console.log('  ✅ Campo motivo_exclusao adicionado');
    }

    if (!existingColumns.includes('excluido_por')) {
      await client.query(`
        ALTER TABLE candidatos 
        ADD COLUMN excluido_por INT REFERENCES usuarios(id);
      `);
      console.log('  ✅ Campo excluido_por adicionado');
    }

    console.log('✅ Campos LGPD adicionados à tabela candidatos\n');

    // ==========================================
    // 3️⃣ CRIAR ÍNDICES PARA PERFORMANCE
    // ==========================================
    console.log('📋 Criando índices...');
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_solicitacoes_lgpd_candidato 
      ON solicitacoes_lgpd(candidato_id);
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_solicitacoes_lgpd_status 
      ON solicitacoes_lgpd(status);
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_solicitacoes_lgpd_email 
      ON solicitacoes_lgpd(email_solicitante);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_candidatos_dados_excluidos 
      ON candidatos(dados_excluidos);
    `);

    console.log('✅ Índices criados\n');

    // ==========================================
    // 4️⃣ CRIAR FUNÇÃO DE ATUALIZAÇÃO AUTOMÁTICA
    // ==========================================
    console.log('📋 Criando trigger de updated_at...');
    
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS update_solicitacoes_lgpd_updated_at 
      ON solicitacoes_lgpd;
    `);

    await client.query(`
      CREATE TRIGGER update_solicitacoes_lgpd_updated_at 
      BEFORE UPDATE ON solicitacoes_lgpd 
      FOR EACH ROW 
      EXECUTE FUNCTION update_updated_at_column();
    `);

    console.log('✅ Trigger criado\n');

    await client.query('COMMIT');

    console.log('═══════════════════════════════════════');
    console.log('✅ MIGRATION LGPD CONCLUÍDA COM SUCESSO!');
    console.log('═══════════════════════════════════════\n');

    console.log('📊 Estrutura criada:');
    console.log('  • Tabela: solicitacoes_lgpd');
    console.log('  • 7 novos campos em candidatos');
    console.log('  • 4 índices para performance');
    console.log('  • 1 trigger de atualização\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro na migration LGPD:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Executar migration
migrateLGPD()
  .then(() => {
    console.log('🎉 Migration executada com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Erro ao executar migration:', error);
    process.exit(1);
  });

