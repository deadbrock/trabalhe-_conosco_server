import { Router, Request, Response } from "express";
import { pool } from "../db";
import { notificarConviteEntrevista } from "../services/gatilhosService";

const router = Router();

// GET - Listar todos os agendamentos (com filtros opcionais)
router.get("/", async (req: Request, res: Response) => {
  try {
    const filialId: number = (req as any).user?.filial_id || 1;
    const { candidato_id, vaga_id, status } = req.query;

    let query = `
      SELECT a.*,
             c.nome as candidato_nome,
             v.titulo as vaga_titulo,
             u.nome as usuario_nome
      FROM agendamentos a
      LEFT JOIN candidatos c ON a.candidato_id = c.id
      LEFT JOIN vagas v ON a.vaga_id = v.id
      LEFT JOIN usuarios u ON a.usuario_id = u.id
      WHERE a.filial_id = $1
    `;

    const params: any[] = [filialId];
    let paramIndex = 2;

    if (candidato_id) {
      query += ` AND a.candidato_id = $${paramIndex}`;
      params.push(candidato_id);
      paramIndex++;
    }

    if (vaga_id) {
      query += ` AND a.vaga_id = $${paramIndex}`;
      params.push(vaga_id);
      paramIndex++;
    }

    if (status) {
      query += ` AND a.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += " ORDER BY a.data_hora ASC";

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao buscar agendamentos:", error);
    res.status(500).json({ error: "Erro ao buscar agendamentos" });
  }
});

// GET - Buscar agendamento por ID
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const filialId: number = (req as any).user?.filial_id || 1;
    const { id } = req.params;

    const result = await pool.query(
      `SELECT a.*,
              c.nome as candidato_nome,
              c.email as candidato_email,
              c.telefone as candidato_telefone,
              v.titulo as vaga_titulo,
              u.nome as usuario_nome
       FROM agendamentos a
       LEFT JOIN candidatos c ON a.candidato_id = c.id
       LEFT JOIN vagas v ON a.vaga_id = v.id
       LEFT JOIN usuarios u ON a.usuario_id = u.id
       WHERE a.id = $1 AND a.filial_id = $2`,
      [id, filialId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Agendamento não encontrado" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Erro ao buscar agendamento:", error);
    res.status(500).json({ error: "Erro ao buscar agendamento" });
  }
});

// POST - Criar novo agendamento
router.post("/", async (req: Request, res: Response) => {
  try {
    const filialId: number = (req as any).user?.filial_id || 1;
    const {
      candidato_id,
      vaga_id,
      usuario_id,
      titulo,
      descricao,
      data_hora,
      local,
      link_video,
      status,
    } = req.body;

    if (!candidato_id || !vaga_id || !usuario_id || !titulo || !data_hora) {
      return res.status(400).json({ error: "Campos obrigatórios faltando" });
    }

    const result = await pool.query(
      `INSERT INTO agendamentos
       (candidato_id, vaga_id, usuario_id, titulo, descricao, data_hora, local, link_video, status, filial_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        candidato_id,
        vaga_id,
        usuario_id,
        titulo,
        descricao,
        data_hora,
        local,
        link_video,
        status || "agendado",
        filialId,
      ]
    );

    const agendamento = result.rows[0];

    const dataFormatada = new Date(data_hora).toLocaleDateString("pt-BR");
    const horaFormatada = new Date(data_hora).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    notificarConviteEntrevista(
      candidato_id,
      vaga_id,
      { data: dataFormatada, hora: horaFormatada, local: local || "A definir", link: link_video || "" },
      filialId
    ).catch((err) => {
      console.error("❌ Erro ao disparar gatilho de convite para entrevista:", err);
    });

    res.status(201).json(agendamento);
  } catch (error) {
    console.error("Erro ao criar agendamento:", error);
    res.status(500).json({ error: "Erro ao criar agendamento" });
  }
});

// PUT - Atualizar agendamento
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const filialId: number = (req as any).user?.filial_id || 1;
    const { id } = req.params;
    const { titulo, descricao, data_hora, local, link_video, status, lembrete_enviado } = req.body;

    const result = await pool.query(
      `UPDATE agendamentos
       SET titulo = COALESCE($1, titulo),
           descricao = COALESCE($2, descricao),
           data_hora = COALESCE($3, data_hora),
           local = COALESCE($4, local),
           link_video = COALESCE($5, link_video),
           status = COALESCE($6, status),
           lembrete_enviado = COALESCE($7, lembrete_enviado),
           atualizado_em = CURRENT_TIMESTAMP
       WHERE id = $8 AND filial_id = $9
       RETURNING *`,
      [titulo, descricao, data_hora, local, link_video, status, lembrete_enviado, id, filialId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Agendamento não encontrado" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Erro ao atualizar agendamento:", error);
    res.status(500).json({ error: "Erro ao atualizar agendamento" });
  }
});

// DELETE - Cancelar/Remover agendamento
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const filialId: number = (req as any).user?.filial_id || 1;
    const { id } = req.params;

    const result = await pool.query(
      "DELETE FROM agendamentos WHERE id = $1 AND filial_id = $2 RETURNING *",
      [id, filialId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Agendamento não encontrado" });
    }

    res.json({ message: "Agendamento removido com sucesso" });
  } catch (error) {
    console.error("Erro ao remover agendamento:", error);
    res.status(500).json({ error: "Erro ao remover agendamento" });
  }
});

// GET - Agendamentos próximos (nos próximos 7 dias)
router.get("/proximos/semana", async (req: Request, res: Response) => {
  try {
    const filialId: number = (req as any).user?.filial_id || 1;

    const result = await pool.query(
      `SELECT a.*,
              c.nome as candidato_nome,
              v.titulo as vaga_titulo
       FROM agendamentos a
       LEFT JOIN candidatos c ON a.candidato_id = c.id
       LEFT JOIN vagas v ON a.vaga_id = v.id
       WHERE a.data_hora BETWEEN NOW() AND NOW() + INTERVAL '7 days'
         AND a.status IN ('agendado', 'confirmado')
         AND a.filial_id = $1
       ORDER BY a.data_hora ASC`,
      [filialId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao buscar agendamentos próximos:", error);
    res.status(500).json({ error: "Erro ao buscar agendamentos próximos" });
  }
});

export default router;
