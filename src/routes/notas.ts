import express from "express";
import { pool } from "../db";
import { registrarAtividade } from "./atividades";

const router = express.Router();

// GET /notas/candidato/:id
router.get("/candidato/:id", async (req, res) => {
  try {
    const filialId: number = (req as any).user?.filial_id || 1;
    const { id } = req.params;

    const result = await pool.query(
      `SELECT * FROM notas_candidatos
       WHERE candidato_id = $1 AND filial_id = $2
       ORDER BY criado_em DESC`,
      [id, filialId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao buscar notas:", error);
    res.status(500).json({ error: "Erro ao buscar notas" });
  }
});

// POST /notas
router.post("/", async (req, res) => {
  try {
    const filialId: number = (req as any).user?.filial_id || 1;
    const userId = (req as any).user?.sub;
    const userName = (req as any).user?.nome || "Usuário";
    const { candidato_id, nota, privada = true } = req.body;

    if (!candidato_id || !nota) {
      return res.status(400).json({ error: "Dados incompletos" });
    }

    const result = await pool.query(
      `INSERT INTO notas_candidatos (candidato_id, usuario_id, usuario_nome, nota, privada, filial_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [candidato_id, userId, userName, nota, privada, filialId]
    );

    const candidato = await pool.query(
      "SELECT nome, vaga_id FROM candidatos WHERE id = $1 AND filial_id = $2",
      [candidato_id, filialId]
    );
    if (candidato.rows.length > 0) {
      await registrarAtividade(
        userId,
        userName,
        candidato_id,
        candidato.rows[0].vaga_id,
        "nota_adicionada",
        `${userName} adicionou uma nota em ${candidato.rows[0].nome}`,
        { nota_id: result.rows[0].id },
        filialId
      );
    }

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Erro ao criar nota:", error);
    res.status(500).json({ error: "Erro ao criar nota" });
  }
});

// PUT /notas/:id
router.put("/:id", async (req, res) => {
  try {
    const filialId: number = (req as any).user?.filial_id || 1;
    const userId = (req as any).user?.sub;
    const { id } = req.params;
    const { nota, privada } = req.body;

    const result = await pool.query(
      `UPDATE notas_candidatos
       SET nota = COALESCE($1, nota),
           privada = COALESCE($2, privada),
           atualizado_em = NOW()
       WHERE id = $3 AND usuario_id = $4 AND filial_id = $5
       RETURNING *`,
      [nota, privada, id, userId, filialId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Nota não encontrada ou sem permissão" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Erro ao atualizar nota:", error);
    res.status(500).json({ error: "Erro ao atualizar nota" });
  }
});

// DELETE /notas/:id
router.delete("/:id", async (req, res) => {
  try {
    const filialId: number = (req as any).user?.filial_id || 1;
    const userId = (req as any).user?.sub;
    const { id } = req.params;

    const result = await pool.query(
      "DELETE FROM notas_candidatos WHERE id = $1 AND usuario_id = $2 AND filial_id = $3 RETURNING *",
      [id, userId, filialId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Nota não encontrada ou sem permissão" });
    }

    res.json({ message: "Nota excluída com sucesso" });
  } catch (error) {
    console.error("Erro ao excluir nota:", error);
    res.status(500).json({ error: "Erro ao excluir nota" });
  }
});

export default router;
