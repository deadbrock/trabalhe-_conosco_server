import { Router } from "express";
import { pool } from "../db";

export const vagasRouter = Router();

vagasRouter.get("/", async (req, res) => {
  const { status = "ativa", q } = req.query as { status?: string; q?: string };
  const hasAll = status === "all";
  const whereParts: string[] = [];
  const params: any[] = [];
  if (!hasAll) {
    params.push(status);
    whereParts.push(`status = $${params.length}`);
  }
  if (q && String(q).trim() !== "") {
    params.push(`%${q}%`);
    whereParts.push(`(titulo ILIKE $${params.length} OR descricao ILIKE $${params.length})`);
  }
  const where = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
  const sql = `SELECT * FROM vagas ${where} ORDER BY criado_em DESC`;
  const { rows } = await pool.query(sql, params);
  res.json(rows);
});

vagasRouter.post("/", async (req, res) => {
  const { titulo, tipo_contrato, endereco, descricao, requisitos, diferenciais, status } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO vagas (titulo, tipo_contrato, endereco, descricao, requisitos, diferenciais, status)
     VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7,'ativa')) RETURNING *`,
    [titulo, tipo_contrato, endereco, descricao, requisitos, diferenciais, status]
  );
  res.status(201).json(rows[0]);
});

vagasRouter.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { titulo, tipo_contrato, endereco, descricao, requisitos, diferenciais, status } = req.body;
  const { rows } = await pool.query(
    `UPDATE vagas SET
      titulo = COALESCE($1, titulo),
      tipo_contrato = COALESCE($2, tipo_contrato),
      endereco = COALESCE($3, endereco),
      descricao = COALESCE($4, descricao),
      requisitos = COALESCE($5, requisitos),
      diferenciais = COALESCE($6, diferenciais),
      status = COALESCE($7, status)
     WHERE id = $8 RETURNING *`,
    [titulo, tipo_contrato, endereco, descricao, requisitos, diferenciais, status, id]
  );
  if (!rows[0]) return res.status(404).json({ error: "Vaga não encontrada" });
  res.json(rows[0]);
});

vagasRouter.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar se há candidatos não movidos para banco de talentos
    const { rows: candidatos } = await pool.query(
      `SELECT COUNT(*) as total FROM candidatos WHERE vaga_id = $1 AND status != 'banco_talentos'`,
      [id]
    );
    
    const totalCandidatos = parseInt(candidatos[0].total);
    
    if (totalCandidatos > 0) {
      return res.status(400).json({
        error: "Não é possível excluir esta vaga",
        message: `Há ${totalCandidatos} candidato(s) vinculado(s) a esta vaga que não estão no Banco de Talentos.`,
        detalhes: "Para excluir a vaga sem perder os candidatos, mova todos para o 'Banco de Talentos' primeiro.",
        candidatosRestantes: totalCandidatos
      });
    }
    
    // Se todos os candidatos estão no banco de talentos ou não há candidatos, pode excluir
    const result = await pool.query("DELETE FROM vagas WHERE id = $1", [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Vaga não encontrada" });
    
    res.status(204).send();
  } catch (error) {
    console.error("Erro ao excluir vaga:", error);
    res.status(500).json({ error: "Erro ao excluir vaga" });
  }
});
