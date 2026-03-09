import express from "express";
import { pool } from "../db";

const router = express.Router();

// GET /notificacoes
router.get("/", async (req, res) => {
  try {
    const userId = (req as any).user?.sub;
    const { lida, limit = 50 } = req.query;

    let query = `SELECT * FROM notificacoes WHERE usuario_id = $1`;
    const params: any[] = [userId];

    if (lida !== undefined) {
      query += ` AND lida = $2`;
      params.push(lida === "true");
    }

    query += ` ORDER BY criado_em DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await pool.query(query, params);

    const countResult = await pool.query(
      "SELECT COUNT(*) as total FROM notificacoes WHERE usuario_id = $1 AND lida = FALSE",
      [userId]
    );

    res.json({
      notificacoes: result.rows,
      nao_lidas: parseInt(countResult.rows[0].total),
    });
  } catch (error) {
    console.error("Erro ao buscar notificações:", error);
    res.status(500).json({ error: "Erro ao buscar notificações" });
  }
});

// POST /notificacoes
router.post("/", async (req, res) => {
  try {
    const { usuario_id, tipo, titulo, mensagem, link } = req.body;

    if (!usuario_id || !tipo || !titulo || !mensagem) {
      return res.status(400).json({ error: "Dados incompletos" });
    }

    const result = await pool.query(
      `INSERT INTO notificacoes (usuario_id, tipo, titulo, mensagem, link)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [usuario_id, tipo, titulo, mensagem, link || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Erro ao criar notificação:", error);
    res.status(500).json({ error: "Erro ao criar notificação" });
  }
});

// PUT /notificacoes/:id/marcar-lida
router.put("/:id/marcar-lida", async (req, res) => {
  try {
    const userId = (req as any).user?.sub;
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE notificacoes SET lida = TRUE WHERE id = $1 AND usuario_id = $2 RETURNING *`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Notificação não encontrada" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Erro ao marcar notificação:", error);
    res.status(500).json({ error: "Erro ao marcar notificação" });
  }
});

// PUT /notificacoes/marcar-todas-lidas
router.put("/marcar-todas-lidas", async (req, res) => {
  try {
    const userId = (req as any).user?.sub;

    await pool.query(
      "UPDATE notificacoes SET lida = TRUE WHERE usuario_id = $1 AND lida = FALSE",
      [userId]
    );

    res.json({ message: "Todas as notificações foram marcadas como lidas" });
  } catch (error) {
    console.error("Erro ao marcar todas as notificações:", error);
    res.status(500).json({ error: "Erro ao marcar todas as notificações" });
  }
});

// DELETE /notificacoes/:id
router.delete("/:id", async (req, res) => {
  try {
    const userId = (req as any).user?.sub;
    const { id } = req.params;

    const result = await pool.query(
      "DELETE FROM notificacoes WHERE id = $1 AND usuario_id = $2 RETURNING *",
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Notificação não encontrada" });
    }

    res.json({ message: "Notificação excluída com sucesso" });
  } catch (error) {
    console.error("Erro ao excluir notificação:", error);
    res.status(500).json({ error: "Erro ao excluir notificação" });
  }
});

export async function criarNotificacao(
  usuario_id: number,
  tipo: string,
  titulo: string,
  mensagem: string,
  link?: string
) {
  try {
    await pool.query(
      `INSERT INTO notificacoes (usuario_id, tipo, titulo, mensagem, link)
       VALUES ($1, $2, $3, $4, $5)`,
      [usuario_id, tipo, titulo, mensagem, link || null]
    );
  } catch (error) {
    console.error("Erro ao criar notificação:", error);
  }
}

/** Notifica todos os usuários de uma mesma filial */
export async function notificarTodosRH(
  tipo: string,
  titulo: string,
  mensagem: string,
  link?: string,
  filial_id: number = 1
) {
  try {
    const usuarios = await pool.query(
      "SELECT id FROM usuarios WHERE filial_id = $1",
      [filial_id]
    );

    for (const usuario of usuarios.rows) {
      await criarNotificacao(usuario.id, tipo, titulo, mensagem, link);
    }
  } catch (error) {
    console.error("Erro ao notificar todos RH:", error);
  }
}

export default router;
