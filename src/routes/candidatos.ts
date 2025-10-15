import { Router } from "express";
import multer from "multer";
import { pool } from "../db";

const upload = multer({ dest: "uploads/" });
export const candidatosRouter = Router();

// Listar todos candidatos (com filtros opcionais)
candidatosRouter.get("/", async (req, res) => {
  const { status } = req.query as { status?: string };
  let query = "SELECT c.*, v.titulo as vaga_titulo FROM candidatos c LEFT JOIN vagas v ON c.vaga_id = v.id";
  const params: any[] = [];
  
  if (status && status !== "all") {
    params.push(status);
    query += ` WHERE c.status = $${params.length}`;
  }
  
  query += " ORDER BY c.data_cadastro DESC";
  
  const { rows } = await pool.query(query, params);
  res.json(rows);
});

// Listar candidatos de uma vaga específica
candidatosRouter.get("/:vagaId", async (req, res) => {
  const { vagaId } = req.params;
  const { rows } = await pool.query(
    "SELECT c.*, v.titulo as vaga_titulo FROM candidatos c LEFT JOIN vagas v ON c.vaga_id = v.id WHERE c.vaga_id = $1 ORDER BY c.data_cadastro DESC",
    [vagaId]
  );
  res.json(rows);
});

candidatosRouter.post("/", upload.single("curriculo"), async (req, res) => {
  const { nome, cpf, data_nascimento, email, telefone, estado, cidade, bairro, vaga_id } = req.body;
  const curriculo = req.file?.filename || null;
  const { rows } = await pool.query(
    `INSERT INTO candidatos (nome, cpf, data_nascimento, email, telefone, estado, cidade, bairro, curriculo, vaga_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [nome, cpf, data_nascimento, email, telefone, estado, cidade, bairro, curriculo, vaga_id]
  );
  res.status(201).json(rows[0]);
});

candidatosRouter.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body as { status?: string };
  const { rows } = await pool.query(
    `UPDATE candidatos SET status = COALESCE($1, status) WHERE id = $2 RETURNING *`,
    [status, id]
  );
  if (!rows[0]) return res.status(404).json({ error: "Candidato não encontrado" });
  res.json(rows[0]);
});
