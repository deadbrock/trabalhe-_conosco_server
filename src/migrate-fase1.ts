import { pool } from "./db";

async function migrateFase1() {
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");
    
    console.log("🚀 Iniciando migração FASE 1...");

    // 1. TABELA DE COMENTÁRIOS
    console.log("📝 Criando tabela 'comentarios'...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS comentarios (
        id SERIAL PRIMARY KEY,
        candidato_id INTEGER NOT NULL REFERENCES candidatos(id) ON DELETE CASCADE,
        usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
        usuario_nome VARCHAR(255) NOT NULL,
        comentario TEXT NOT NULL,
        importante BOOLEAN DEFAULT FALSE,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Índices para performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_comentarios_candidato 
      ON comentarios(candidato_id)
    `);

    // 2. TABELA DE TAGS
    console.log("🏷️ Criando tabela 'tags'...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS tags (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(100) NOT NULL UNIQUE,
        cor VARCHAR(7) DEFAULT '#3B82F6',
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 3. TABELA DE RELACIONAMENTO CANDIDATO-TAGS
    console.log("🔗 Criando tabela 'candidato_tags'...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS candidato_tags (
        id SERIAL PRIMARY KEY,
        candidato_id INTEGER NOT NULL REFERENCES candidatos(id) ON DELETE CASCADE,
        tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(candidato_id, tag_id)
      )
    `);

    // Índices para performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_candidato_tags_candidato 
      ON candidato_tags(candidato_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_candidato_tags_tag 
      ON candidato_tags(tag_id)
    `);

    // 4. ADICIONAR COLUNA SCORE EM CANDIDATOS
    console.log("⭐ Adicionando coluna 'score' em candidatos...");
    await client.query(`
      ALTER TABLE candidatos 
      ADD COLUMN IF NOT EXISTS score INTEGER DEFAULT 0
    `);

    // 5. TABELA DE AGENDAMENTOS
    console.log("📅 Criando tabela 'agendamentos'...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS agendamentos (
        id SERIAL PRIMARY KEY,
        candidato_id INTEGER NOT NULL REFERENCES candidatos(id) ON DELETE CASCADE,
        vaga_id INTEGER NOT NULL REFERENCES vagas(id) ON DELETE CASCADE,
        usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
        titulo VARCHAR(255) NOT NULL,
        descricao TEXT,
        data_hora TIMESTAMP NOT NULL,
        local VARCHAR(255),
        link_video VARCHAR(500),
        status VARCHAR(50) DEFAULT 'agendado',
        lembrete_enviado BOOLEAN DEFAULT FALSE,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Índices para performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_agendamentos_candidato 
      ON agendamentos(candidato_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_agendamentos_data 
      ON agendamentos(data_hora)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_agendamentos_status 
      ON agendamentos(status)
    `);

    // 6. INSERIR TAGS PADRÃO
    console.log("🏷️ Inserindo tags padrão...");
    await client.query(`
      INSERT INTO tags (nome, cor) VALUES
        ('Experiência Relevante', '#10B981'),
        ('Disponível Imediato', '#F59E0B'),
        ('Boa Comunicação', '#3B82F6'),
        ('Localização Próxima', '#8B5CF6'),
        ('Formação Superior', '#EC4899'),
        ('Indicação', '#F97316'),
        ('Destaque', '#EF4444')
      ON CONFLICT (nome) DO NOTHING
    `);

    await client.query("COMMIT");
    console.log("✅ Migração FASE 1 concluída com sucesso!");
    
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Erro na migração:", error);
    throw error;
  } finally {
    client.release();
  }
}

migrateFase1()
  .then(() => {
    console.log("🎉 Banco de dados atualizado!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("💥 Falha na migração:", err);
    process.exit(1);
  });

