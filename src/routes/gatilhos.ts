import express, { Request, Response } from "express";
import { pool } from "../db";

const router = express.Router();

// GET /gatilhos - Listar configurações de gatilhos da filial
router.get("/", async (req: Request, res: Response) => {
  try {
    const filialId: number = (req as any).user?.filial_id || 1;

    const result = await pool.query(
      `SELECT
        g.*,
        te.nome as template_email_nome,
        tw.nome as template_whatsapp_nome
       FROM configuracao_gatilhos g
       LEFT JOIN templates te ON g.template_email_id = te.id
       LEFT JOIN templates tw ON g.template_whatsapp_id = tw.id
       WHERE g.filial_id = $1
       ORDER BY g.criado_em`,
      [filialId]
    );

    res.json({ gatilhos: result.rows, total: result.rows.length });
  } catch (error) {
    console.error("Erro ao listar gatilhos:", error);
    res.status(500).json({ error: "Erro ao listar gatilhos" });
  }
});

// GET /gatilhos/:evento
router.get("/:evento", async (req: Request, res: Response) => {
  try {
    const filialId: number = (req as any).user?.filial_id || 1;
    const { evento } = req.params;

    const result = await pool.query(
      `SELECT
        g.*,
        te.nome as template_email_nome,
        te.conteudo as template_email_conteudo,
        tw.nome as template_whatsapp_nome,
        tw.conteudo as template_whatsapp_conteudo
       FROM configuracao_gatilhos g
       LEFT JOIN templates te ON g.template_email_id = te.id
       LEFT JOIN templates tw ON g.template_whatsapp_id = tw.id
       WHERE g.evento = $1 AND g.filial_id = $2`,
      [evento, filialId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Gatilho não encontrado" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Erro ao buscar gatilho:", error);
    res.status(500).json({ error: "Erro ao buscar gatilho" });
  }
});

// PUT /gatilhos/:evento
router.put("/:evento", async (req: Request, res: Response) => {
  try {
    const filialId: number = (req as any).user?.filial_id || 1;
    const { evento } = req.params;
    const {
      descricao,
      email_ativo,
      whatsapp_ativo,
      template_email_id,
      template_whatsapp_id,
      delay_minutos,
      horario_comercial,
      dias_uteis,
      horario_inicio,
      horario_fim,
    } = req.body;

    const exists = await pool.query(
      "SELECT id FROM configuracao_gatilhos WHERE evento = $1 AND filial_id = $2",
      [evento, filialId]
    );

    if (exists.rows.length === 0) {
      return res.status(404).json({ error: "Gatilho não encontrado" });
    }

    if (template_email_id) {
      const emailTemplate = await pool.query(
        "SELECT id FROM templates WHERE id = $1 AND tipo = $2 AND filial_id = $3",
        [template_email_id, "email", filialId]
      );
      if (emailTemplate.rows.length === 0) {
        return res.status(400).json({ error: "Template de email inválido" });
      }
    }

    if (template_whatsapp_id) {
      const whatsappTemplate = await pool.query(
        "SELECT id FROM templates WHERE id = $1 AND tipo = $2 AND filial_id = $3",
        [template_whatsapp_id, "whatsapp", filialId]
      );
      if (whatsappTemplate.rows.length === 0) {
        return res.status(400).json({ error: "Template de WhatsApp inválido" });
      }
    }

    const result = await pool.query(
      `UPDATE configuracao_gatilhos
       SET descricao = COALESCE($1, descricao),
           email_ativo = COALESCE($2, email_ativo),
           whatsapp_ativo = COALESCE($3, whatsapp_ativo),
           template_email_id = COALESCE($4, template_email_id),
           template_whatsapp_id = COALESCE($5, template_whatsapp_id),
           delay_minutos = COALESCE($6, delay_minutos),
           horario_comercial = COALESCE($7, horario_comercial),
           dias_uteis = COALESCE($8, dias_uteis),
           horario_inicio = COALESCE($9, horario_inicio),
           horario_fim = COALESCE($10, horario_fim),
           atualizado_em = NOW()
       WHERE evento = $11 AND filial_id = $12
       RETURNING *`,
      [
        descricao,
        email_ativo,
        whatsapp_ativo,
        template_email_id,
        template_whatsapp_id,
        delay_minutos,
        horario_comercial,
        dias_uteis,
        horario_inicio,
        horario_fim,
        evento,
        filialId,
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Erro ao atualizar gatilho:", error);
    res.status(500).json({ error: "Erro ao atualizar gatilho" });
  }
});

// PATCH /gatilhos/:evento/toggle-email
router.patch("/:evento/toggle-email", async (req: Request, res: Response) => {
  try {
    const filialId: number = (req as any).user?.filial_id || 1;
    const { evento } = req.params;

    const result = await pool.query(
      `UPDATE configuracao_gatilhos
       SET email_ativo = NOT email_ativo, atualizado_em = NOW()
       WHERE evento = $1 AND filial_id = $2
       RETURNING *`,
      [evento, filialId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Gatilho não encontrado" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Erro ao alternar email:", error);
    res.status(500).json({ error: "Erro ao alternar email" });
  }
});

// PATCH /gatilhos/:evento/toggle-whatsapp
router.patch("/:evento/toggle-whatsapp", async (req: Request, res: Response) => {
  try {
    const filialId: number = (req as any).user?.filial_id || 1;
    const { evento } = req.params;

    const result = await pool.query(
      `UPDATE configuracao_gatilhos
       SET whatsapp_ativo = NOT whatsapp_ativo, atualizado_em = NOW()
       WHERE evento = $1 AND filial_id = $2
       RETURNING *`,
      [evento, filialId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Gatilho não encontrado" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Erro ao alternar WhatsApp:", error);
    res.status(500).json({ error: "Erro ao alternar WhatsApp" });
  }
});

export default router;
