import { pool } from "./db";

async function migrateFiliais() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Criar tabela filiais
    await client.query(`
      CREATE TABLE IF NOT EXISTS filiais (
        id   SERIAL PRIMARY KEY,
        nome TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        ativa BOOLEAN DEFAULT TRUE,
        criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // 2. Inserir as duas filiais (sem conflito se já existirem)
    await client.query(`
      INSERT INTO filiais (id, nome, slug) VALUES (1, 'Sede', 'sede')
      ON CONFLICT (id) DO NOTHING;
    `);
    await client.query(`
      INSERT INTO filiais (id, nome, slug) VALUES (2, 'Fortaleza', 'fortaleza')
      ON CONFLICT (id) DO NOTHING;
    `);
    // Ajustar a sequência para não colidir com os IDs inseridos manualmente
    await client.query(`SELECT setval('filiais_id_seq', (SELECT MAX(id) FROM filiais));`);

    // 3. Adicionar filial_id em todas as tabelas relevantes
    const tabelas = [
      "usuarios",
      "vagas",
      "candidatos",
      "agendamentos",
      "comentarios",
      "historico_comunicacao",
      "atividades",
      "templates",
      "configuracao_gatilhos",
      "notas_candidatos",
      "avaliacoes",
      "tags",
    ];

    for (const tabela of tabelas) {
      // Adiciona coluna se não existir, com DEFAULT 1 (Sede)
      await client.query(`
        ALTER TABLE ${tabela}
        ADD COLUMN IF NOT EXISTS filial_id INTEGER REFERENCES filiais(id) DEFAULT 1;
      `);
      // Garante que todos os registros existentes ficam associados à Sede
      await client.query(`
        UPDATE ${tabela} SET filial_id = 1 WHERE filial_id IS NULL;
      `);
    }

    // 4. Para configuracao_gatilhos: criar cópias dos gatilhos para Fortaleza
    //    (cada filial precisa de suas próprias configurações de automação)
    const gatilhosExistentes = await client.query(`
      SELECT evento, descricao, email_ativo, whatsapp_ativo,
             delay_minutos, horario_comercial, dias_uteis, horario_inicio, horario_fim
      FROM configuracao_gatilhos
      WHERE filial_id = 1
    `);

    for (const g of gatilhosExistentes.rows) {
      await client.query(
        `INSERT INTO configuracao_gatilhos
          (evento, descricao, email_ativo, whatsapp_ativo,
           delay_minutos, horario_comercial, dias_uteis, horario_inicio, horario_fim, filial_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 2)
         ON CONFLICT DO NOTHING`,
        [
          g.evento,
          g.descricao,
          g.email_ativo,
          g.whatsapp_ativo,
          g.delay_minutos,
          g.horario_comercial,
          g.dias_uteis,
          g.horario_inicio,
          g.horario_fim,
        ]
      );
    }

    await client.query("COMMIT");
    console.log("✅ Migration de filiais concluída com sucesso");
    console.log("   → Tabela 'filiais' criada com Sede (id=1) e Fortaleza (id=2)");
    console.log("   → Coluna 'filial_id' adicionada em todas as tabelas");
    console.log("   → Dados existentes associados à Sede (filial_id=1)");
    console.log("   → Gatilhos duplicados para Fortaleza (sem templates por enquanto)");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Erro na migration de filiais:", err);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

migrateFiliais().then(() => process.exit());
