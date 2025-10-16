import { Router } from "express";
import { pool } from "../db";
import bcrypt from "bcryptjs";

export const setupRouter = Router();

// Rota para criar usuário Leilani
setupRouter.get("/criar-usuario-leilani", async (req, res) => {
  try {
    const email = "gestaorh@fgservices.com.br";
    const senha = "gestaoleilanisupersecreta2026";
    const nome = "Leilani - Gestão RH";
    
    // Verificar se já existe
    const { rows: existing } = await pool.query(
      "SELECT * FROM usuarios WHERE email = $1",
      [email]
    );
    
    if (existing.length > 0) {
      return res.json({ 
        message: "ℹ️ Usuário já existe!", 
        email: email 
      });
    }
    
    // Criar hash da senha
    const senhaHash = await bcrypt.hash(senha, 10);
    
    // Inserir usuário
    await pool.query(
      "INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES ($1, $2, $3, $4)",
      [nome, email, senhaHash, "admin"]
    );
    
    res.json({ 
      message: "✅ Usuário criado com sucesso!",
      nome: nome,
      email: email,
      senha: senha,
      instrucoes: "Faça login em https://www.trabalheconoscofg.com.br/rh/login"
    });
  } catch (error) {
    console.error("❌ Erro ao criar usuário:", error);
    res.status(500).json({ error: "Erro ao criar usuário" });
  }
});

