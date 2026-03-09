import express from "express";
import { pool } from "../db";
import { registrarAtividade } from "./atividades";

const router = express.Router();

// GET /avaliacoes/candidato/:id
router.get("/candidato/:id", async (req, res) => {
  try {
    const filialId: number = (req as any).user?.filial_id || 1;
    const { id } = req.params;

    const result = await pool.query(
      `SELECT * FROM avaliacoes WHERE candidato_id = $1 AND filial_id = $2 ORDER BY criado_em DESC`,
      [id, filialId]
    );

    const mediaResult = await pool.query(
      `SELECT
        AVG(comunicacao) as media_comunicacao,
        AVG(experiencia_tecnica) as media_experiencia,
        AVG(fit_cultural) as media_fit_cultural,
        AVG(apresentacao) as media_apresentacao,
        AVG(disponibilidade) as media_disponibilidade,
        AVG(nota_geral) as media_geral,
        COUNT(*) as total_avaliacoes
       FROM avaliacoes
       WHERE candidato_id = $1 AND filial_id = $2`,
      [id, filialId]
    );

    res.json({ avaliacoes: result.rows, media: mediaResult.rows[0] });
  } catch (error) {
    console.error("Erro ao buscar avaliações:", error);
    res.status(500).json({ error: "Erro ao buscar avaliações" });
  }
});

// POST /avaliacoes
router.post("/", async (req, res) => {
  try {
    const filialId: number = (req as any).user?.filial_id || 1;
    const userId = (req as any).user?.sub;
    const userName = (req as any).user?.nome || "Usuário";
    const {
      candidato_id,
      comunicacao,
      experiencia_tecnica,
      fit_cultural,
      apresentacao,
      disponibilidade,
      comentario,
    } = req.body;

    if (!candidato_id) {
      return res.status(400).json({ error: "candidato_id é obrigatório" });
    }

    if (!comunicacao && !experiencia_tecnica && !fit_cultural && !apresentacao && !disponibilidade) {
      return res.status(400).json({ error: "Preencha pelo menos um critério de avaliação" });
    }

    const result = await pool.query(
      `INSERT INTO avaliacoes
       (candidato_id, usuario_id, usuario_nome, comunicacao, experiencia_tecnica,
        fit_cultural, apresentacao, disponibilidade, comentario, filial_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        candidato_id,
        userId,
        userName,
        comunicacao || null,
        experiencia_tecnica || null,
        fit_cultural || null,
        apresentacao || null,
        disponibilidade || null,
        comentario || null,
        filialId,
      ]
    );

    const notaGeral = result.rows[0].nota_geral;
    const scoreNormalizado = Math.round((notaGeral / 5) * 100);

    await pool.query(
      "UPDATE candidatos SET score = $1 WHERE id = $2 AND filial_id = $3",
      [scoreNormalizado, candidato_id, filialId]
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
        "avaliacao_adicionada",
        `${userName} avaliou ${candidato.rows[0].nome} (${notaGeral.toFixed(1)} ⭐)`,
        { avaliacao_id: result.rows[0].id, nota_geral: notaGeral },
        filialId
      );
    }

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Erro ao criar avaliação:", error);
    res.status(500).json({ error: "Erro ao criar avaliação" });
  }
});

// PUT /avaliacoes/:id
router.put("/:id", async (req, res) => {
  try {
    const filialId: number = (req as any).user?.filial_id || 1;
    const userId = (req as any).user?.sub;
    const { id } = req.params;
    const { comunicacao, experiencia_tecnica, fit_cultural, apresentacao, disponibilidade, comentario } = req.body;

    const result = await pool.query(
      `UPDATE avaliacoes
       SET comunicacao = COALESCE($1, comunicacao),
           experiencia_tecnica = COALESCE($2, experiencia_tecnica),
           fit_cultural = COALESCE($3, fit_cultural),
           apresentacao = COALESCE($4, apresentacao),
           disponibilidade = COALESCE($5, disponibilidade),
           comentario = COALESCE($6, comentario),
           atualizado_em = NOW()
       WHERE id = $7 AND usuario_id = $8 AND filial_id = $9
       RETURNING *`,
      [comunicacao, experiencia_tecnica, fit_cultural, apresentacao, disponibilidade, comentario, id, userId, filialId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Avaliação não encontrada ou sem permissão" });
    }

    const notaGeral = result.rows[0].nota_geral;
    const scoreNormalizado = Math.round((notaGeral / 5) * 100);

    await pool.query(
      "UPDATE candidatos SET score = $1 WHERE id = $2 AND filial_id = $3",
      [scoreNormalizado, result.rows[0].candidato_id, filialId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Erro ao atualizar avaliação:", error);
    res.status(500).json({ error: "Erro ao atualizar avaliação" });
  }
});

// DELETE /avaliacoes/:id
router.delete("/:id", async (req, res) => {
  try {
    const filialId: number = (req as any).user?.filial_id || 1;
    const userId = (req as any).user?.sub;
    const { id } = req.params;

    const result = await pool.query(
      "DELETE FROM avaliacoes WHERE id = $1 AND usuario_id = $2 AND filial_id = $3 RETURNING *",
      [id, userId, filialId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Avaliação não encontrada ou sem permissão" });
    }

    res.json({ message: "Avaliação excluída com sucesso" });
  } catch (error) {
    console.error("Erro ao excluir avaliação:", error);
    res.status(500).json({ error: "Erro ao excluir avaliação" });
  }
});

export default router;
