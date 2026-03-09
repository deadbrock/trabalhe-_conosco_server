import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../db";

export const authRouter = Router();

authRouter.post("/login", async (req, res) => {
  const { email, senha } = req.body as { email: string; senha: string };
  const { rows } = await pool.query(
    `SELECT u.*, f.nome as filial_nome
     FROM usuarios u
     LEFT JOIN filiais f ON u.filial_id = f.id
     WHERE u.email = $1`,
    [email]
  );
  const user = rows[0];
  if (!user) return res.status(401).json({ error: "Credenciais inválidas" });

  const ok = await bcrypt.compare(senha, user.senha_hash);
  if (!ok) return res.status(401).json({ error: "Credenciais inválidas" });

  const filialId = user.filial_id || 1;
  const filialNome = user.filial_nome || "Sede";

  const token = jwt.sign(
    {
      sub: user.id,
      nome: user.nome,
      email: user.email,
      perfil: user.perfil,
      filial_id: filialId,
      filial_nome: filialNome,
    },
    process.env.JWT_SECRET || "secret",
    { expiresIn: "8h" }
  );

  res.json({
    token,
    usuario: {
      id: user.id,
      nome: user.nome,
      email: user.email,
      perfil: user.perfil,
      filial_id: filialId,
      filial_nome: filialNome,
    },
  });
});

authRouter.post("/logout", async (_req, res) => {
  // Sem state server-side (JWT stateless). Cliente deve descartar o token.
  res.status(204).send();
});
