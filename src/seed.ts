import { pool } from "./db";
import bcrypt from "bcryptjs";

async function seed() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Verifica se já existe um usuário admin
    const { rows } = await client.query("SELECT * FROM usuarios WHERE email = $1", ["admin@fgservices.com"]);
    
    if (rows.length === 0) {
      // Cria senha hash para "admin123"
      const senhaHash = await bcrypt.hash("admin123", 10);
      
      await client.query(
        "INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES ($1, $2, $3, $4)",
        ["Administrador", "admin@fgservices.com", senhaHash, "admin"]
      );
      
      console.log("✅ Usuário administrador criado com sucesso!");
      console.log("📧 Email: admin@fgservices.com");
      console.log("🔑 Senha: admin123");
      console.log("\n⚠️  IMPORTANTE: Altere a senha após o primeiro login!");
    } else {
      console.log("ℹ️  Usuário administrador já existe");
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Erro ao criar usuário:", err);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

seed().then(() => process.exit());

