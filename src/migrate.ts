import { pool } from "./db";

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`
      CREATE TABLE IF NOT EXISTS vagas (
        id SERIAL PRIMARY KEY,
        titulo TEXT NOT NULL,
        tipo_contrato TEXT NOT NULL,
        endereco TEXT NOT NULL,
        descricao TEXT,
        requisitos TEXT,
        diferenciais TEXT,
        status TEXT DEFAULT 'ativa',
        criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        nome TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        senha_hash TEXT NOT NULL,
        perfil TEXT NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS candidatos (
        id SERIAL PRIMARY KEY,
        nome TEXT NOT NULL,
        cpf TEXT NOT NULL,
        data_nascimento DATE,
        email TEXT NOT NULL,
        telefone TEXT,
        estado TEXT,
        cidade TEXT,
        bairro TEXT,
        curriculo TEXT,
        vaga_id INTEGER REFERENCES vagas(id) ON DELETE CASCADE,
        status TEXT DEFAULT 'novo',
        data_cadastro TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    await client.query("COMMIT");
    console.log("Migração concluída com sucesso");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Erro na migração:", err);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

migrate().then(() => process.exit());
