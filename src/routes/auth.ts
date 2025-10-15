import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../db";

export const authRouter = Router();

authRouter.post("/login", async (req, res) => {
  const { email, senha } = req.body as { email: string; senha: string };
  const { rows } = await pool.query("SELECT * FROM usuarios WHERE email = $1", [email]);
  const user = rows[0];
  if (!user) return res.status(401).json({ error: "Credenciais inválidas" });

  const ok = await bcrypt.compare(senha, user.senha_hash);
  if (!ok) return res.status(401).json({ error: "Credenciais inválidas" });

  const token = jwt.sign({ sub: user.id, perfil: user.perfil }, process.env.JWT_SECRET || "secret", { expiresIn: "8h" });
  res.json({ token, usuario: { id: user.id, nome: user.nome, email: user.email, perfil: user.perfil } });
});

authRouter.post("/logout", async (_req, res) => {
  // Sem state server-side (JWT stateless). Cliente deve descartar o token.
  res.status(204).send();
});
