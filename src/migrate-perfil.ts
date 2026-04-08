import { pool } from "./db";

async function migratePerfil() {
  const client = await pool.connect();
  try {
    console.log("🔧 Iniciando migration: colunas de perfil em usuarios...");

    await client.query("BEGIN");

    const { rows } = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'usuarios'
        AND column_name IN ('telefone', 'cargo', 'foto_perfil', 'criado_em', 'data_atualizacao')
    `);
    const existing = new Set(rows.map((r: { column_name: string }) => r.column_name));

    if (!existing.has("telefone")) {
      await client.query(`ALTER TABLE usuarios ADD COLUMN telefone TEXT;`);
      console.log("  ✅ Coluna telefone adicionada");
    } else {
      console.log("  ℹ️  telefone já existe");
    }

    if (!existing.has("cargo")) {
      await client.query(`ALTER TABLE usuarios ADD COLUMN cargo TEXT;`);
      console.log("  ✅ Coluna cargo adicionada");
    } else {
      console.log("  ℹ️  cargo já existe");
    }

    if (!existing.has("foto_perfil")) {
      await client.query(`ALTER TABLE usuarios ADD COLUMN foto_perfil TEXT;`);
      console.log("  ✅ Coluna foto_perfil adicionada");
    } else {
      console.log("  ℹ️  foto_perfil já existe");
    }

    if (!existing.has("criado_em")) {
      await client.query(`ALTER TABLE usuarios ADD COLUMN criado_em TIMESTAMPTZ DEFAULT NOW();`);
      console.log("  ✅ Coluna criado_em adicionada");
    } else {
      console.log("  ℹ️  criado_em já existe");
    }

    if (!existing.has("data_atualizacao")) {
      await client.query(`ALTER TABLE usuarios ADD COLUMN data_atualizacao TIMESTAMPTZ;`);
      console.log("  ✅ Coluna data_atualizacao adicionada");
    } else {
      console.log("  ℹ️  data_atualizacao já existe");
    }

    await client.query("COMMIT");
    console.log("✅ Migration perfil de usuário concluída.\n");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Erro na migration:", err);
    process.exitCode = 1;
  } finally {
    client.release();
    process.exit();
  }
}

migratePerfil();
