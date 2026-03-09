import express, { Request, Response } from "express";
import { pool } from "../db";

const router = express.Router();

// GET /templates - Listar todos os templates da filial
router.get("/", async (req: Request, res: Response) => {
  try {
    const filialId: number = (req as any).user?.filial_id || 1;
    const { tipo, ativo } = req.query;

    let query = "SELECT * FROM templates WHERE filial_id = $1";
    const params: any[] = [filialId];
    let paramCount = 2;

    if (tipo) {
      query += ` AND tipo = $${paramCount}`;
      params.push(tipo);
      paramCount++;
    }

    if (ativo !== undefined) {
      query += ` AND ativo = $${paramCount}`;
      params.push(ativo === "true");
      paramCount++;
    }

    query += " ORDER BY criado_em DESC";

    const result = await pool.query(query, params);

    res.json({ templates: result.rows, total: result.rows.length });
  } catch (error) {
    console.error("Erro ao listar templates:", error);
    res.status(500).json({ error: "Erro ao listar templates" });
  }
});

// GET /templates/:id
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const filialId: number = (req as any).user?.filial_id || 1;
    const { id } = req.params;

    const result = await pool.query(
      "SELECT * FROM templates WHERE id = $1 AND filial_id = $2",
      [id, filialId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Template não encontrado" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Erro ao buscar template:", error);
    res.status(500).json({ error: "Erro ao buscar template" });
  }
});

// POST /templates
router.post("/", async (req: Request, res: Response) => {
  try {
    const filialId: number = (req as any).user?.filial_id || 1;
    const { tipo, nome, assunto, conteudo, variaveis, ativo } = req.body;

    if (!tipo || !["email", "whatsapp"].includes(tipo)) {
      return res.status(400).json({ error: 'Tipo inválido. Use "email" ou "whatsapp"' });
    }

    if (!nome || !conteudo) {
      return res.status(400).json({ error: "Nome e conteúdo são obrigatórios" });
    }

    if (tipo === "email" && !assunto) {
      return res.status(400).json({ error: "Assunto é obrigatório para templates de email" });
    }

    const result = await pool.query(
      `INSERT INTO templates (tipo, nome, assunto, conteudo, variaveis, ativo, filial_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [tipo, nome, assunto || null, conteudo, JSON.stringify(variaveis || []), ativo !== false, filialId]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Erro ao criar template:", error);
    res.status(500).json({ error: "Erro ao criar template" });
  }
});

// PUT /templates/:id
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const filialId: number = (req as any).user?.filial_id || 1;
    const { id } = req.params;
    const { tipo, nome, assunto, conteudo, variaveis, ativo } = req.body;

    const exists = await pool.query(
      "SELECT id FROM templates WHERE id = $1 AND filial_id = $2",
      [id, filialId]
    );
    if (exists.rows.length === 0) {
      return res.status(404).json({ error: "Template não encontrado" });
    }

    if (tipo && !["email", "whatsapp"].includes(tipo)) {
      return res.status(400).json({ error: 'Tipo inválido. Use "email" ou "whatsapp"' });
    }

    const result = await pool.query(
      `UPDATE templates
       SET tipo = COALESCE($1, tipo),
           nome = COALESCE($2, nome),
           assunto = COALESCE($3, assunto),
           conteudo = COALESCE($4, conteudo),
           variaveis = COALESCE($5, variaveis),
           ativo = COALESCE($6, ativo),
           atualizado_em = NOW()
       WHERE id = $7 AND filial_id = $8
       RETURNING *`,
      [tipo, nome, assunto, conteudo, variaveis ? JSON.stringify(variaveis) : null, ativo, id, filialId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Erro ao atualizar template:", error);
    res.status(500).json({ error: "Erro ao atualizar template" });
  }
});

// DELETE /templates/:id
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const filialId: number = (req as any).user?.filial_id || 1;
    const { id } = req.params;

    const usedInGatilhos = await pool.query(
      `SELECT COUNT(*) as count FROM configuracao_gatilhos
       WHERE (template_email_id = $1 OR template_whatsapp_id = $1) AND filial_id = $2`,
      [id, filialId]
    );

    if (parseInt(usedInGatilhos.rows[0].count) > 0) {
      return res.status(400).json({
        error: "Template está sendo usado em gatilhos e não pode ser deletado. Desative-o primeiro.",
      });
    }

    const result = await pool.query(
      "DELETE FROM templates WHERE id = $1 AND filial_id = $2 RETURNING id",
      [id, filialId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Template não encontrado" });
    }

    res.json({ message: "Template deletado com sucesso", id: result.rows[0].id });
  } catch (error) {
    console.error("Erro ao deletar template:", error);
    res.status(500).json({ error: "Erro ao deletar template" });
  }
});

// PATCH /templates/:id/toggle
router.patch("/:id/toggle", async (req: Request, res: Response) => {
  try {
    const filialId: number = (req as any).user?.filial_id || 1;
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE templates
       SET ativo = NOT ativo, atualizado_em = NOW()
       WHERE id = $1 AND filial_id = $2
       RETURNING *`,
      [id, filialId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Template não encontrado" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Erro ao alternar status do template:", error);
    res.status(500).json({ error: "Erro ao alternar status do template" });
  }
});

// POST /templates/:id/duplicate
router.post("/:id/duplicate", async (req: Request, res: Response) => {
  try {
    const filialId: number = (req as any).user?.filial_id || 1;
    const { id } = req.params;

    const original = await pool.query(
      "SELECT * FROM templates WHERE id = $1 AND filial_id = $2",
      [id, filialId]
    );

    if (original.rows.length === 0) {
      return res.status(404).json({ error: "Template não encontrado" });
    }

    const template = original.rows[0];

    const result = await pool.query(
      `INSERT INTO templates (tipo, nome, assunto, conteudo, variaveis, ativo, filial_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        template.tipo,
        `${template.nome} (Cópia)`,
        template.assunto,
        template.conteudo,
        template.variaveis,
        false,
        filialId,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Erro ao duplicar template:", error);
    res.status(500).json({ error: "Erro ao duplicar template" });
  }
});

// POST /templates/:id/preview
router.post("/:id/preview", async (req: Request, res: Response) => {
  try {
    const filialId: number = (req as any).user?.filial_id || 1;
    const { id } = req.params;
    const dadosExemplo = req.body;

    const result = await pool.query(
      "SELECT * FROM templates WHERE id = $1 AND filial_id = $2",
      [id, filialId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Template não encontrado" });
    }

    const template = result.rows[0];
    let conteudoPreview = template.conteudo;
    let assuntoPreview = template.assunto;

    const dadosPadrao = {
      nome: "João da Silva",
      email: "joao@example.com",
      telefone: "(11) 98765-4321",
      vaga: "Desenvolvedor Full Stack",
      empresa: "FG Services",
      data: new Date().toLocaleDateString("pt-BR"),
      hora: "14:00",
      local: "Rua Exemplo, 123 - São Paulo/SP",
      link: "https://meet.google.com/abc-defg-hij",
      rh_nome: "Maria Santos",
      rh_email: "rh@fgservices.com.br",
      rh_telefone: "(11) 3456-7890",
      ...dadosExemplo,
    };

    Object.entries(dadosPadrao).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, "g");
      conteudoPreview = conteudoPreview.replace(regex, String(value));
      if (assuntoPreview) {
        assuntoPreview = assuntoPreview.replace(regex, String(value));
      }
    });

    res.json({
      tipo: template.tipo,
      nome: template.nome,
      assunto: assuntoPreview,
      conteudo: conteudoPreview,
      dados_usados: dadosPadrao,
    });
  } catch (error) {
    console.error("Erro ao gerar preview:", error);
    res.status(500).json({ error: "Erro ao gerar preview" });
  }
});

export default router;
