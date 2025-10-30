import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Iniciando migração FASE 3...\n');

    // 1. Tabela de Notificações
    console.log('📬 Criando tabela de notificações...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS notificacoes (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
        tipo VARCHAR(50) NOT NULL,
        titulo VARCHAR(255) NOT NULL,
        mensagem TEXT NOT NULL,
        link VARCHAR(255),
        lida BOOLEAN DEFAULT FALSE,
        criado_em TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_notificacoes_usuario ON notificacoes(usuario_id);
      CREATE INDEX IF NOT EXISTS idx_notificacoes_lida ON notificacoes(lida);
    `);
    console.log('✅ Tabela notificacoes criada!\n');

    // 2. Tabela de Histórico de Atividades
    console.log('📜 Criando tabela de histórico de atividades...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS atividades (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
        usuario_nome VARCHAR(255),
        candidato_id INTEGER REFERENCES candidatos(id) ON DELETE CASCADE,
        vaga_id INTEGER REFERENCES vagas(id) ON DELETE CASCADE,
        tipo VARCHAR(100) NOT NULL,
        descricao TEXT NOT NULL,
        dados_extras JSONB,
        criado_em TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_atividades_candidato ON atividades(candidato_id);
      CREATE INDEX IF NOT EXISTS idx_atividades_vaga ON atividades(vaga_id);
      CREATE INDEX IF NOT EXISTS idx_atividades_tipo ON atividades(tipo);
      CREATE INDEX IF NOT EXISTS idx_atividades_data ON atividades(criado_em DESC);
    `);
    console.log('✅ Tabela atividades criada!\n');

    // 3. Tabela de Notas de Candidatos
    console.log('📝 Criando tabela de notas...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS notas_candidatos (
        id SERIAL PRIMARY KEY,
        candidato_id INTEGER REFERENCES candidatos(id) ON DELETE CASCADE,
        usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
        usuario_nome VARCHAR(255),
        nota TEXT NOT NULL,
        privada BOOLEAN DEFAULT TRUE,
        criado_em TIMESTAMP DEFAULT NOW(),
        atualizado_em TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_notas_candidato ON notas_candidatos(candidato_id);
    `);
    console.log('✅ Tabela notas_candidatos criada!\n');

    // 4. Tabela de Avaliações
    console.log('⭐ Criando tabela de avaliações...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS avaliacoes (
        id SERIAL PRIMARY KEY,
        candidato_id INTEGER REFERENCES candidatos(id) ON DELETE CASCADE,
        usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
        usuario_nome VARCHAR(255),
        
        -- Critérios de avaliação (1-5 estrelas)
        comunicacao INTEGER CHECK (comunicacao >= 1 AND comunicacao <= 5),
        experiencia_tecnica INTEGER CHECK (experiencia_tecnica >= 1 AND experiencia_tecnica <= 5),
        fit_cultural INTEGER CHECK (fit_cultural >= 1 AND fit_cultural <= 5),
        apresentacao INTEGER CHECK (apresentacao >= 1 AND apresentacao <= 5),
        disponibilidade INTEGER CHECK (disponibilidade >= 1 AND disponibilidade <= 5),
        
        -- Média geral
        nota_geral DECIMAL(3,2),
        
        -- Comentário opcional
        comentario TEXT,
        
        criado_em TIMESTAMP DEFAULT NOW(),
        atualizado_em TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_avaliacoes_candidato ON avaliacoes(candidato_id);
      
      -- Função para calcular média automaticamente
      CREATE OR REPLACE FUNCTION calcular_nota_geral()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.nota_geral := (
          COALESCE(NEW.comunicacao, 0) +
          COALESCE(NEW.experiencia_tecnica, 0) +
          COALESCE(NEW.fit_cultural, 0) +
          COALESCE(NEW.apresentacao, 0) +
          COALESCE(NEW.disponibilidade, 0)
        ) / 5.0;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_calcular_nota_geral ON avaliacoes;
      CREATE TRIGGER trigger_calcular_nota_geral
        BEFORE INSERT OR UPDATE ON avaliacoes
        FOR EACH ROW
        EXECUTE FUNCTION calcular_nota_geral();
    `);
    console.log('✅ Tabela avaliacoes criada!\n');

    // 5. Adicionar colunas de rastreamento em tabelas existentes (se não existirem)
    console.log('🔧 Adicionando colunas de rastreamento...');
    
    // Verificar e adicionar coluna de última atividade em candidatos
    const checkLastActivity = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'candidatos' AND column_name = 'ultima_atividade'
    `);
    
    if (checkLastActivity.rows.length === 0) {
      await client.query(`
        ALTER TABLE candidatos 
        ADD COLUMN ultima_atividade TIMESTAMP DEFAULT NOW();
        
        CREATE INDEX IF NOT EXISTS idx_candidatos_ultima_atividade ON candidatos(ultima_atividade DESC);
      `);
      console.log('✅ Coluna ultima_atividade adicionada em candidatos!\n');
    } else {
      console.log('ℹ️  Coluna ultima_atividade já existe em candidatos.\n');
    }

    console.log('🎉 Migração FASE 3 concluída com sucesso!\n');
    console.log('📊 Resumo:');
    console.log('  ✅ Tabela notificacoes');
    console.log('  ✅ Tabela atividades');
    console.log('  ✅ Tabela notas_candidatos');
    console.log('  ✅ Tabela avaliacoes');
    console.log('  ✅ Índices otimizados');
    console.log('  ✅ Triggers automáticos\n');

  } catch (error) {
    console.error('💥 Falha na migração:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration()
  .then(() => {
    console.log('✅ Script de migração executado com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro ao executar migração:', error);
    process.exit(1);
  });

