/**
 * Seed: cria usuário(s) para a filial de Fortaleza.
 * Execute APÓS a migration de filiais: npm run migrate:filiais
 * Uso: npm run seed:fortaleza
 */

import { pool } from "./db";
import bcrypt from "bcryptjs";

async function seedFortaleza() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Garantir que a filial Fortaleza existe (id=2)
    const filialCheck = await client.query(
      "SELECT id FROM filiais WHERE slug = 'fortaleza'"
    );
    if (filialCheck.rows.length === 0) {
      console.error("❌ Filial 'fortaleza' não encontrada. Execute npm run migrate:filiais primeiro.");
      process.exitCode = 1;
      return;
    }
    const filialId = filialCheck.rows[0].id;

    // Criar usuário RH de Fortaleza
    const senhaHash = await bcrypt.hash("rh@fortaleza2024", 10);

    const { rows } = await client.query(
      `INSERT INTO usuarios (nome, email, senha_hash, perfil, filial_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE
         SET nome = EXCLUDED.nome,
             perfil = EXCLUDED.perfil,
             filial_id = EXCLUDED.filial_id
       RETURNING id, nome, email, perfil, filial_id`,
      ["RH Fortaleza", "rh.fortaleza@fgservices.com.br", senhaHash, "admin", filialId]
    );

    await client.query("COMMIT");

    console.log("✅ Seed de Fortaleza concluído!");
    console.log("");
    console.log("👤 Usuário criado:");
    console.log(`   Nome:     ${rows[0].nome}`);
    console.log(`   Email:    ${rows[0].email}`);
    console.log(`   Senha:    rh@fortaleza2024`);
    console.log(`   Perfil:   ${rows[0].perfil}`);
    console.log(`   Filial:   Fortaleza (id=${rows[0].filial_id})`);
    console.log("");
    console.log("⚠️  IMPORTANTE: Troque a senha após o primeiro acesso!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Erro no seed de Fortaleza:", err);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

seedFortaleza().then(() => process.exit());
