import { Router, Request, Response } from "express";
import { pool } from "../db";

const router = Router();

// GET - Listar comentários de um candidato
router.get("/:candidatoId", async (req: Request, res: Response) => {
  try {
    const { candidatoId } = req.params;
    
    const result = await pool.query(
      `SELECT c.*, u.nome as usuario_nome
       FROM comentarios c
       LEFT JOIN usuarios u ON c.usuario_id = u.id
       WHERE c.candidato_id = $1
       ORDER BY c.criado_em DESC`,
      [candidatoId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao buscar comentários:", error);
    res.status(500).json({ error: "Erro ao buscar comentários" });
  }
});

// POST - Adicionar comentário
router.post("/", async (req: Request, res: Response) => {
  try {
    const { candidato_id, usuario_id, usuario_nome, comentario, importante } = req.body;
    
    if (!candidato_id || !usuario_id || !usuario_nome || !comentario) {
      return res.status(400).json({ error: "Campos obrigatórios faltando" });
    }
    
    const result = await pool.query(
      `INSERT INTO comentarios (candidato_id, usuario_id, usuario_nome, comentario, importante)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [candidato_id, usuario_id, usuario_nome, comentario, importante || false]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Erro ao adicionar comentário:", error);
    res.status(500).json({ error: "Erro ao adicionar comentário" });
  }
});

// PUT - Atualizar comentário
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { comentario, importante } = req.body;
    
    const result = await pool.query(
      `UPDATE comentarios 
       SET comentario = COALESCE($1, comentario),
           importante = COALESCE($2, importante)
       WHERE id = $3
       RETURNING *`,
      [comentario, importante, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Comentário não encontrado" });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Erro ao atualizar comentário:", error);
    res.status(500).json({ error: "Erro ao atualizar comentário" });
  }
});

// DELETE - Remover comentário
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      "DELETE FROM comentarios WHERE id = $1 RETURNING *",
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Comentário não encontrado" });
    }
    
    res.json({ message: "Comentário removido com sucesso" });
  } catch (error) {
    console.error("Erro ao remover comentário:", error);
    res.status(500).json({ error: "Erro ao remover comentário" });
  }
});

export default router;

