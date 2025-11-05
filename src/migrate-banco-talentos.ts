import { pool } from "./db";

async function migrateBancoTalentos() {
  const client = await pool.connect();
  try {
    console.log("🔧 Iniciando migration: Banco de Talentos...");
    
    await client.query("BEGIN");

    // 1. Remover a constraint antiga
    console.log("1️⃣ Removendo constraint antiga...");
    await client.query(`
      ALTER TABLE candidatos 
      DROP CONSTRAINT IF EXISTS candidatos_vaga_id_fkey;
    `);

    // 2. Permitir que vaga_id seja NULL
    console.log("2️⃣ Permitindo vaga_id NULL...");
    await client.query(`
      ALTER TABLE candidatos 
      ALTER COLUMN vaga_id DROP NOT NULL;
    `);

    // 3. Adicionar nova constraint com SET NULL
    console.log("3️⃣ Adicionando nova constraint (ON DELETE SET NULL)...");
    await client.query(`
      ALTER TABLE candidatos 
      ADD CONSTRAINT candidatos_vaga_id_fkey 
      FOREIGN KEY (vaga_id) 
      REFERENCES vagas(id) 
      ON DELETE SET NULL;
    `);

    await client.query("COMMIT");
    
    console.log("✅ Migration concluída com sucesso!");
    console.log("\n📋 Agora:");
    console.log("   - Candidatos no banco de talentos NÃO serão deletados");
    console.log("   - Apenas o vaga_id ficará NULL quando a vaga for excluída");
    console.log("   - Candidatos em processo continuam sendo deletados normalmente\n");
    
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Erro na migration:", err);
    process.exitCode = 1;
  } finally {
    client.release();
    process.exit();
  }
}

migrateBancoTalentos();

