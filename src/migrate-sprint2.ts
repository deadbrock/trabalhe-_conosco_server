import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 5000
});

async function migrateSprint2() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Iniciando migração Sprint 2 - Comunicação Automatizada...\n');

    await client.query('BEGIN');

    // ==========================================
    // 1. TABELA DE TEMPLATES
    // ==========================================
    console.log('📝 Criando tabela de templates...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS templates (
        id SERIAL PRIMARY KEY,
        tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('email', 'whatsapp')),
        nome VARCHAR(255) NOT NULL,
        assunto VARCHAR(500),
        conteudo TEXT NOT NULL,
        variaveis JSONB DEFAULT '[]',
        ativo BOOLEAN DEFAULT TRUE,
        estatisticas JSONB DEFAULT '{"enviados": 0, "entregues": 0, "lidos": 0, "falhas": 0}',
        criado_em TIMESTAMP DEFAULT NOW(),
        atualizado_em TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_templates_tipo ON templates(tipo);
      CREATE INDEX IF NOT EXISTS idx_templates_ativo ON templates(ativo);
    `);
    console.log('✅ Tabela templates criada\n');

    // ==========================================
    // 2. TABELA DE HISTÓRICO DE COMUNICAÇÃO
    // ==========================================
    console.log('📧 Criando tabela de histórico de comunicação...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS historico_comunicacao (
        id SERIAL PRIMARY KEY,
        candidato_id INTEGER REFERENCES candidatos(id) ON DELETE CASCADE,
        vaga_id INTEGER REFERENCES vagas(id) ON DELETE SET NULL,
        usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
        template_id INTEGER REFERENCES templates(id) ON DELETE SET NULL,
        tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('email', 'whatsapp')),
        destinatario VARCHAR(255) NOT NULL,
        assunto VARCHAR(500),
        conteudo TEXT NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'enviado' CHECK (status IN ('pendente', 'enviado', 'entregue', 'lido', 'falhou')),
        erro TEXT,
        metadata JSONB DEFAULT '{}',
        enviado_por VARCHAR(50) DEFAULT 'automatico' CHECK (enviado_por IN ('automatico', 'manual')),
        enviado_em TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_historico_candidato ON historico_comunicacao(candidato_id);
      CREATE INDEX IF NOT EXISTS idx_historico_vaga ON historico_comunicacao(vaga_id);
      CREATE INDEX IF NOT EXISTS idx_historico_tipo ON historico_comunicacao(tipo);
      CREATE INDEX IF NOT EXISTS idx_historico_status ON historico_comunicacao(status);
      CREATE INDEX IF NOT EXISTS idx_historico_enviado_em ON historico_comunicacao(enviado_em DESC);
    `);
    console.log('✅ Tabela historico_comunicacao criada\n');

    // ==========================================
    // 3. TABELA DE CONFIGURAÇÃO DE GATILHOS
    // ==========================================
    console.log('⚡ Criando tabela de configuração de gatilhos...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS configuracao_gatilhos (
        id SERIAL PRIMARY KEY,
        evento VARCHAR(100) NOT NULL UNIQUE,
        descricao TEXT,
        email_ativo BOOLEAN DEFAULT TRUE,
        whatsapp_ativo BOOLEAN DEFAULT TRUE,
        template_email_id INTEGER REFERENCES templates(id) ON DELETE SET NULL,
        template_whatsapp_id INTEGER REFERENCES templates(id) ON DELETE SET NULL,
        delay_minutos INTEGER DEFAULT 0,
        horario_comercial BOOLEAN DEFAULT FALSE,
        dias_uteis BOOLEAN DEFAULT FALSE,
        horario_inicio TIME DEFAULT '08:00:00',
        horario_fim TIME DEFAULT '18:00:00',
        criado_em TIMESTAMP DEFAULT NOW(),
        atualizado_em TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_gatilhos_evento ON configuracao_gatilhos(evento);
    `);
    console.log('✅ Tabela configuracao_gatilhos criada\n');

    // ==========================================
    // 4. TABELA DE FILA DE ENVIO (para envios agendados)
    // ==========================================
    console.log('📬 Criando tabela de fila de envio...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS fila_envio (
        id SERIAL PRIMARY KEY,
        candidato_id INTEGER REFERENCES candidatos(id) ON DELETE CASCADE,
        vaga_id INTEGER REFERENCES vagas(id) ON DELETE SET NULL,
        template_id INTEGER REFERENCES templates(id) ON DELETE CASCADE,
        tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('email', 'whatsapp')),
        destinatario VARCHAR(255) NOT NULL,
        dados JSONB NOT NULL,
        agendado_para TIMESTAMP NOT NULL,
        tentativas INTEGER DEFAULT 0,
        max_tentativas INTEGER DEFAULT 3,
        status VARCHAR(50) DEFAULT 'pendente' CHECK (status IN ('pendente', 'processando', 'enviado', 'falhou', 'cancelado')),
        erro TEXT,
        criado_em TIMESTAMP DEFAULT NOW(),
        processado_em TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_fila_status ON fila_envio(status);
      CREATE INDEX IF NOT EXISTS idx_fila_agendado ON fila_envio(agendado_para);
    `);
    console.log('✅ Tabela fila_envio criada\n');

    // ==========================================
    // 5. FUNÇÃO DE ATUALIZAÇÃO AUTOMÁTICA
    // ==========================================
    console.log('🔧 Criando função de atualização automática...');
    await client.query(`
      CREATE OR REPLACE FUNCTION atualizar_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.atualizado_em = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_atualizar_templates ON templates;
      CREATE TRIGGER trigger_atualizar_templates
        BEFORE UPDATE ON templates
        FOR EACH ROW
        EXECUTE FUNCTION atualizar_timestamp();

      DROP TRIGGER IF EXISTS trigger_atualizar_gatilhos ON configuracao_gatilhos;
      CREATE TRIGGER trigger_atualizar_gatilhos
        BEFORE UPDATE ON configuracao_gatilhos
        FOR EACH ROW
        EXECUTE FUNCTION atualizar_timestamp();
    `);
    console.log('✅ Funções e triggers criados\n');

    // ==========================================
    // 6. INSERIR GATILHOS PADRÃO
    // ==========================================
    console.log('⚙️ Inserindo configurações de gatilhos padrão...');
    await client.query(`
      INSERT INTO configuracao_gatilhos (evento, descricao, email_ativo, whatsapp_ativo, delay_minutos, horario_comercial)
      VALUES 
        ('inscricao_recebida', 'Candidato se inscreveu em uma vaga', true, true, 0, false),
        ('status_em_analise', 'Status do candidato mudou para "Em Análise"', true, false, 0, false),
        ('status_pre_selecionado', 'Candidato foi pré-selecionado', true, true, 0, false),
        ('convite_entrevista', 'Entrevista foi agendada', true, true, 0, false),
        ('status_aprovado', 'Candidato foi aprovado', true, true, 0, false),
        ('status_reprovado', 'Candidato foi reprovado', true, true, 60, true),
        ('lembrete_entrevista', 'Lembrete 1 dia antes da entrevista', true, true, 0, false)
      ON CONFLICT (evento) DO NOTHING;
    `);
    console.log('✅ Gatilhos padrão inseridos\n');

    await client.query('COMMIT');

    console.log('🎉 Migração Sprint 2 concluída com sucesso!\n');
    console.log('📊 Tabelas criadas:');
    console.log('   - templates');
    console.log('   - historico_comunicacao');
    console.log('   - configuracao_gatilhos');
    console.log('   - fila_envio\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('💥 Erro na migração:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrateSprint2()
  .then(() => {
    console.log('✅ Migração finalizada com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Falha na migração:', error);
    process.exit(1);
  });

