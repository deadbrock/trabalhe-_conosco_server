import express, { Request, Response } from 'express';
import { Pool } from 'pg';

const router = express.Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ==========================================
// GET /gatilhos - Listar todas as configurações de gatilhos
// ==========================================
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT 
        g.*,
        te.nome as template_email_nome,
        tw.nome as template_whatsapp_nome
      FROM configuracao_gatilhos g
      LEFT JOIN templates te ON g.template_email_id = te.id
      LEFT JOIN templates tw ON g.template_whatsapp_id = tw.id
      ORDER BY g.criado_em
    `);

    res.json({
      gatilhos: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Erro ao listar gatilhos:', error);
    res.status(500).json({ error: 'Erro ao listar gatilhos' });
  }
});

// ==========================================
// GET /gatilhos/:evento - Buscar configuração por evento
// ==========================================
router.get('/:evento', async (req: Request, res: Response) => {
  try {
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
      WHERE g.evento = $1`,
      [evento]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Gatilho não encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao buscar gatilho:', error);
    res.status(500).json({ error: 'Erro ao buscar gatilho' });
  }
});

// ==========================================
// PUT /gatilhos/:evento - Atualizar configuração de gatilho
// ==========================================
router.put('/:evento', async (req: Request, res: Response) => {
  try {
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
      horario_fim
    } = req.body;

    // Verificar se gatilho existe
    const exists = await pool.query(
      'SELECT id FROM configuracao_gatilhos WHERE evento = $1',
      [evento]
    );

    if (exists.rows.length === 0) {
      return res.status(404).json({ error: 'Gatilho não encontrado' });
    }

    // Validar templates se fornecidos
    if (template_email_id) {
      const emailTemplate = await pool.query(
        'SELECT id FROM templates WHERE id = $1 AND tipo = $2',
        [template_email_id, 'email']
      );
      if (emailTemplate.rows.length === 0) {
        return res.status(400).json({ error: 'Template de email inválido' });
      }
    }

    if (template_whatsapp_id) {
      const whatsappTemplate = await pool.query(
        'SELECT id FROM templates WHERE id = $1 AND tipo = $2',
        [template_whatsapp_id, 'whatsapp']
      );
      if (whatsappTemplate.rows.length === 0) {
        return res.status(400).json({ error: 'Template de WhatsApp inválido' });
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
       WHERE evento = $11
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
        evento
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar gatilho:', error);
    res.status(500).json({ error: 'Erro ao atualizar gatilho' });
  }
});

// ==========================================
// PATCH /gatilhos/:evento/toggle-email - Ativar/Desativar email
// ==========================================
router.patch('/:evento/toggle-email', async (req: Request, res: Response) => {
  try {
    const { evento } = req.params;

    const result = await pool.query(
      `UPDATE configuracao_gatilhos 
       SET email_ativo = NOT email_ativo, atualizado_em = NOW()
       WHERE evento = $1
       RETURNING *`,
      [evento]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Gatilho não encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao alternar email:', error);
    res.status(500).json({ error: 'Erro ao alternar email' });
  }
});

// ==========================================
// PATCH /gatilhos/:evento/toggle-whatsapp - Ativar/Desativar WhatsApp
// ==========================================
router.patch('/:evento/toggle-whatsapp', async (req: Request, res: Response) => {
  try {
    const { evento } = req.params;

    const result = await pool.query(
      `UPDATE configuracao_gatilhos 
       SET whatsapp_ativo = NOT whatsapp_ativo, atualizado_em = NOW()
       WHERE evento = $1
       RETURNING *`,
      [evento]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Gatilho não encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao alternar WhatsApp:', error);
    res.status(500).json({ error: 'Erro ao alternar WhatsApp' });
  }
});

export default router;

