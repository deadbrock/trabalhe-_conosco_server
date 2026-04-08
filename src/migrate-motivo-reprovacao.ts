import { pool } from "./db";

async function migrateMotivoReprovacao() {
  const client = await pool.connect();
  try {
    console.log("🔧 Iniciando migration: motivo e data de reprovação em candidatos...");

    await client.query("BEGIN");

    const { rows } = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'candidatos'
        AND column_name IN ('motivo_reprovacao', 'data_reprovacao')
    `);
    const existing = new Set(rows.map((r: { column_name: string }) => r.column_name));

    if (!existing.has("motivo_reprovacao")) {
      await client.query(`
        ALTER TABLE candidatos
        ADD COLUMN motivo_reprovacao TEXT;
      `);
      console.log("  ✅ Coluna motivo_reprovacao adicionada");
    } else {
      console.log("  ℹ️  motivo_reprovacao já existe");
    }

    if (!existing.has("data_reprovacao")) {
      await client.query(`
        ALTER TABLE candidatos
        ADD COLUMN data_reprovacao TIMESTAMPTZ;
      `);
      console.log("  ✅ Coluna data_reprovacao adicionada");
    } else {
      console.log("  ℹ️  data_reprovacao já existe");
    }

    await client.query("COMMIT");
    console.log("✅ Migration motivo reprovação concluída.\n");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Erro na migration:", err);
    process.exitCode = 1;
  } finally {
    client.release();
    process.exit();
  }
}

migrateMotivoReprovacao();
