import { Router, Request, Response } from "express";
import { pool } from "../db";

const router = Router();

// GET - Listar todas as tags
router.get("/", async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      "SELECT * FROM tags ORDER BY nome ASC"
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao buscar tags:", error);
    res.status(500).json({ error: "Erro ao buscar tags" });
  }
});

// GET - Listar tags de um candidato
router.get("/candidato/:candidatoId", async (req: Request, res: Response) => {
  try {
    const { candidatoId } = req.params;
    
    const result = await pool.query(
      `SELECT t.* 
       FROM tags t
       INNER JOIN candidato_tags ct ON t.id = ct.tag_id
       WHERE ct.candidato_id = $1
       ORDER BY t.nome ASC`,
      [candidatoId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao buscar tags do candidato:", error);
    res.status(500).json({ error: "Erro ao buscar tags do candidato" });
  }
});

// POST - Criar nova tag
router.post("/", async (req: Request, res: Response) => {
  try {
    const { nome, cor } = req.body;
    
    if (!nome) {
      return res.status(400).json({ error: "Nome da tag é obrigatório" });
    }
    
    const result = await pool.query(
      `INSERT INTO tags (nome, cor)
       VALUES ($1, $2)
       RETURNING *`,
      [nome, cor || '#3B82F6']
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    if (error.code === '23505') { // Duplicate key
      return res.status(400).json({ error: "Tag já existe" });
    }
    console.error("Erro ao criar tag:", error);
    res.status(500).json({ error: "Erro ao criar tag" });
  }
});

// POST - Adicionar tag a um candidato
router.post("/candidato", async (req: Request, res: Response) => {
  try {
    const { candidato_id, tag_id } = req.body;
    
    if (!candidato_id || !tag_id) {
      return res.status(400).json({ error: "candidato_id e tag_id são obrigatórios" });
    }
    
    await pool.query(
      `INSERT INTO candidato_tags (candidato_id, tag_id)
       VALUES ($1, $2)
       ON CONFLICT (candidato_id, tag_id) DO NOTHING`,
      [candidato_id, tag_id]
    );
    
    // Retornar a tag adicionada
    const result = await pool.query(
      "SELECT * FROM tags WHERE id = $1",
      [tag_id]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Erro ao adicionar tag ao candidato:", error);
    res.status(500).json({ error: "Erro ao adicionar tag ao candidato" });
  }
});

// DELETE - Remover tag de um candidato
router.delete("/candidato/:candidatoId/:tagId", async (req: Request, res: Response) => {
  try {
    const { candidatoId, tagId } = req.params;
    
    await pool.query(
      "DELETE FROM candidato_tags WHERE candidato_id = $1 AND tag_id = $2",
      [candidatoId, tagId]
    );
    
    res.json({ message: "Tag removida do candidato com sucesso" });
  } catch (error) {
    console.error("Erro ao remover tag do candidato:", error);
    res.status(500).json({ error: "Erro ao remover tag do candidato" });
  }
});

// PUT - Atualizar tag
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { nome, cor } = req.body;
    
    const result = await pool.query(
      `UPDATE tags 
       SET nome = COALESCE($1, nome),
           cor = COALESCE($2, cor)
       WHERE id = $3
       RETURNING *`,
      [nome, cor, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Tag não encontrada" });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Erro ao atualizar tag:", error);
    res.status(500).json({ error: "Erro ao atualizar tag" });
  }
});

// DELETE - Remover tag (remove de todos os candidatos também)
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      "DELETE FROM tags WHERE id = $1 RETURNING *",
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Tag não encontrada" });
    }
    
    res.json({ message: "Tag removida com sucesso" });
  } catch (error) {
    console.error("Erro ao remover tag:", error);
    res.status(500).json({ error: "Erro ao remover tag" });
  }
});

export default router;

