/**
 * Seed: cria usuário GESTOR (coordenadora de RH) com acesso a todas as filiais.
 * Execute APÓS a migration de filiais: npm run migrate:filiais
 * Uso: npm run seed:gestor
 */

import { pool } from "./db";
import bcrypt from "bcryptjs";

async function seedGestor() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Garantir que a filial Sede existe (gestor fica associado à Sede por padrão)
    const filialCheck = await client.query("SELECT id FROM filiais WHERE slug = 'sede'");
    if (filialCheck.rows.length === 0) {
      console.error("❌ Filial 'sede' não encontrada. Execute npm run migrate:filiais primeiro.");
      process.exitCode = 1;
      return;
    }
    const filialId = filialCheck.rows[0].id;

    // Criar usuário GESTOR (coordenadora)
    const senhaHash = await bcrypt.hash("coordenadora@2024", 10);

    const { rows } = await client.query(
      `INSERT INTO usuarios (nome, email, senha_hash, perfil, filial_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE
         SET nome = EXCLUDED.nome,
             perfil = EXCLUDED.perfil,
             filial_id = EXCLUDED.filial_id
       RETURNING id, nome, email, perfil, filial_id`,
      ["Coordenadora RH", "coordenadora@fgservices.com.br", senhaHash, "gestor", filialId]
    );

    await client.query("COMMIT");

    console.log("✅ Seed de Gestor concluído!");
    console.log("");
    console.log("👤 Usuário GESTOR criado:");
    console.log(`   Nome:     ${rows[0].nome}`);
    console.log(`   Email:    ${rows[0].email}`);
    console.log(`   Senha:    coordenadora@2024`);
    console.log(`   Perfil:   ${rows[0].perfil} (acesso a TODAS as filiais)`);
    console.log(`   Filial:   Sede (id=${rows[0].filial_id}) - apenas para referência`);
    console.log("");
    console.log("⚠️  IMPORTANTE: Troque a senha após o primeiro acesso!");
    console.log("🔐 Este usuário tem acesso total ao painel de gestão (/gestao)");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Erro no seed de Gestor:", err);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

seedGestor().then(() => process.exit());
