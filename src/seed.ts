import { pool } from "./db";
import bcrypt from "bcryptjs";

async function seed() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Lista de usuários para criar
    const usuarios = [
      { nome: "Administrador", email: "admin@fgservices.com", senha: "admin123", perfil: "admin" },
      { nome: "Thais - RH", email: "rh@fgservices.com.br", senha: "recursosthais2025", perfil: "admin" },
      { nome: "Claudia - RH", email: "rh-2@fgservices.com.br", senha: "recursosclaudia2025", perfil: "admin" },
      { nome: "Josiellen - RH", email: "rh-3@fgservices.com.br", senha: "recursosjosiellen2025", perfil: "admin" },
      { nome: "Leilani - Gestão RH", email: "gestaorh@fgservices.com.br", senha: "gestaoleilanisupersecreta2026", perfil: "admin" },
    ];

    for (const user of usuarios) {
      // Verifica se já existe
      const { rows } = await client.query("SELECT * FROM usuarios WHERE email = $1", [user.email]);
      
      if (rows.length === 0) {
        // Cria senha hash
        const senhaHash = await bcrypt.hash(user.senha, 10);
        
        await client.query(
          "INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES ($1, $2, $3, $4)",
          [user.nome, user.email, senhaHash, user.perfil]
        );
        
        console.log(`✅ Usuário criado: ${user.nome}`);
        console.log(`   📧 Email: ${user.email}`);
        console.log(`   🔑 Senha: ${user.senha}\n`);
      } else {
        console.log(`ℹ️  Usuário já existe: ${user.email}`);
      }
    }

    await client.query("COMMIT");
    console.log("\n🎉 Seed concluído com sucesso!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Erro ao criar usuários:", err);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

seed().then(() => process.exit());

