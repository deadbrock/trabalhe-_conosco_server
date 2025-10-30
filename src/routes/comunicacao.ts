import express, { Request, Response } from 'express';
import { Pool } from 'pg';
import { enviarEmail, substituirVariaveis as substituirVariaveisEmail } from '../services/emailService';
import { enviarWhatsApp, substituirVariaveis as substituirVariaveisWhatsApp } from '../services/whatsappService';

const router = express.Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

interface AuthRequest extends Request {
  user?: {
    id: number;
    nome: string;
    email: string;
  };
}

// ==========================================
// GET /comunicacao/historico - Listar histórico de comunicações
// ==========================================
router.get('/historico', async (req: Request, res: Response) => {
  try {
    const { candidato_id, vaga_id, tipo, status, limit = 50, offset = 0 } = req.query;
    
    let query = `
      SELECT 
        hc.*,
        c.nome as candidato_nome,
        c.email as candidato_email,
        v.titulo as vaga_titulo,
        u.nome as usuario_nome,
        t.nome as template_nome
      FROM historico_comunicacao hc
      LEFT JOIN candidatos c ON hc.candidato_id = c.id
      LEFT JOIN vagas v ON hc.vaga_id = v.id
      LEFT JOIN usuarios u ON hc.usuario_id = u.id
      LEFT JOIN templates t ON hc.template_id = t.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 1;

    if (candidato_id) {
      query += ` AND hc.candidato_id = $${paramCount}`;
      params.push(candidato_id);
      paramCount++;
    }

    if (vaga_id) {
      query += ` AND hc.vaga_id = $${paramCount}`;
      params.push(vaga_id);
      paramCount++;
    }

    if (tipo) {
      query += ` AND hc.tipo = $${paramCount}`;
      params.push(tipo);
      paramCount++;
    }

    if (status) {
      query += ` AND hc.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    query += ` ORDER BY hc.enviado_em DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Contar total
    let countQuery = 'SELECT COUNT(*) FROM historico_comunicacao WHERE 1=1';
    const countParams: any[] = [];
    let countParamIndex = 1;

    if (candidato_id) {
      countQuery += ` AND candidato_id = $${countParamIndex}`;
      countParams.push(candidato_id);
      countParamIndex++;
    }

    if (vaga_id) {
      countQuery += ` AND vaga_id = $${countParamIndex}`;
      countParams.push(vaga_id);
      countParamIndex++;
    }

    if (tipo) {
      countQuery += ` AND tipo = $${countParamIndex}`;
      countParams.push(tipo);
      countParamIndex++;
    }

    if (status) {
      countQuery += ` AND status = $${countParamIndex}`;
      countParams.push(status);
      countParamIndex++;
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      historico: result.rows,
      total,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });
  } catch (error) {
    console.error('Erro ao listar histórico:', error);
    res.status(500).json({ error: 'Erro ao listar histórico' });
  }
});

// ==========================================
// POST /comunicacao/enviar - Enviar comunicação manual
// ==========================================
router.post('/enviar', async (req: AuthRequest, res: Response) => {
  try {
    const {
      candidato_id,
      vaga_id,
      template_id,
      tipo,
      destinatario,
      assunto,
      conteudo,
      variaveis
    } = req.body;

    // Validações
    if (!tipo || !['email', 'whatsapp'].includes(tipo)) {
      return res.status(400).json({ error: 'Tipo inválido' });
    }

    if (!destinatario || !conteudo) {
      return res.status(400).json({ error: 'Destinatário e conteúdo são obrigatórios' });
    }

    if (tipo === 'email' && !assunto) {
      return res.status(400).json({ error: 'Assunto é obrigatório para emails' });
    }

    // Substituir variáveis
    let conteudoFinal = conteudo;
    let assuntoFinal = assunto;

    if (variaveis && Object.keys(variaveis).length > 0) {
      if (tipo === 'email') {
        conteudoFinal = await substituirVariaveisEmail(conteudo, variaveis);
        if (assunto) {
          assuntoFinal = await substituirVariaveisEmail(assunto, variaveis);
        }
      } else {
        conteudoFinal = await substituirVariaveisWhatsApp(conteudo, variaveis);
      }
    }

    // Enviar
    let resultado;
    if (tipo === 'email') {
      resultado = await enviarEmail({
        destinatario,
        assunto: assuntoFinal || '',
        conteudo: conteudoFinal
      });
    } else {
      resultado = await enviarWhatsApp({
        numero: destinatario,
        mensagem: conteudoFinal
      });
    }

    // Salvar no histórico
    await pool.query(
      `INSERT INTO historico_comunicacao 
        (candidato_id, vaga_id, usuario_id, template_id, tipo, destinatario, assunto, conteudo, status, erro, metadata, enviado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        candidato_id || null,
        vaga_id || null,
        req.user?.id || null,
        template_id || null,
        tipo,
        destinatario,
        assuntoFinal || null,
        conteudoFinal,
        resultado.sucesso ? 'enviado' : 'falhou',
        resultado.erro || null,
        JSON.stringify({ messageId: resultado.messageId }),
        'manual'
      ]
    );

    if (!resultado.sucesso) {
      return res.status(500).json({ 
        error: 'Falha ao enviar', 
        detalhes: resultado.erro 
      });
    }

    res.json({ 
      message: 'Comunicação enviada com sucesso',
      messageId: resultado.messageId
    });
  } catch (error) {
    console.error('Erro ao enviar comunicação:', error);
    res.status(500).json({ error: 'Erro ao enviar comunicação' });
  }
});

// ==========================================
// POST /comunicacao/enviar-template - Enviar usando template
// ==========================================
router.post('/enviar-template', async (req: AuthRequest, res: Response) => {
  try {
    const {
      candidato_id,
      vaga_id,
      template_id,
      variaveis
    } = req.body;

    if (!template_id) {
      return res.status(400).json({ error: 'template_id é obrigatório' });
    }

    // Buscar template
    const templateResult = await pool.query(
      'SELECT * FROM templates WHERE id = $1 AND ativo = true',
      [template_id]
    );

    if (templateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Template não encontrado ou inativo' });
    }

    const template = templateResult.rows[0];

    // Buscar dados do candidato se fornecido
    let destinatario = '';
    let dadosVariaveis = { ...variaveis };

    if (candidato_id) {
      const candidatoResult = await pool.query(
        'SELECT * FROM candidatos WHERE id = $1',
        [candidato_id]
      );

      if (candidatoResult.rows.length > 0) {
        const candidato = candidatoResult.rows[0];
        destinatario = template.tipo === 'email' ? candidato.email : candidato.telefone;
        
        // Adicionar dados do candidato às variáveis
        dadosVariaveis = {
          nome: candidato.nome,
          email: candidato.email,
          telefone: candidato.telefone,
          ...dadosVariaveis
        };
      }
    }

    // Buscar dados da vaga se fornecido
    if (vaga_id) {
      const vagaResult = await pool.query(
        'SELECT * FROM vagas WHERE id = $1',
        [vaga_id]
      );

      if (vagaResult.rows.length > 0) {
        dadosVariaveis.vaga = vagaResult.rows[0].titulo;
      }
    }

    // Adicionar dados padrão
    dadosVariaveis = {
      empresa: 'FG Services',
      data: new Date().toLocaleDateString('pt-BR'),
      rh_nome: req.user?.nome || 'Equipe de RH',
      rh_email: req.user?.email || 'rh@fgservices.com.br',
      ...dadosVariaveis
    };

    // Substituir variáveis
    let conteudoFinal = template.conteudo;
    let assuntoFinal = template.assunto;

    if (template.tipo === 'email') {
      conteudoFinal = await substituirVariaveisEmail(template.conteudo, dadosVariaveis);
      if (template.assunto) {
        assuntoFinal = await substituirVariaveisEmail(template.assunto, dadosVariaveis);
      }
    } else {
      conteudoFinal = await substituirVariaveisWhatsApp(template.conteudo, dadosVariaveis);
    }

    // Enviar
    let resultado;
    if (template.tipo === 'email') {
      resultado = await enviarEmail({
        destinatario,
        assunto: assuntoFinal || '',
        conteudo: conteudoFinal
      });
    } else {
      resultado = await enviarWhatsApp({
        numero: destinatario,
        mensagem: conteudoFinal
      });
    }

    // Salvar no histórico
    await pool.query(
      `INSERT INTO historico_comunicacao 
        (candidato_id, vaga_id, usuario_id, template_id, tipo, destinatario, assunto, conteudo, status, erro, metadata, enviado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        candidato_id || null,
        vaga_id || null,
        req.user?.id || null,
        template_id,
        template.tipo,
        destinatario,
        assuntoFinal || null,
        conteudoFinal,
        resultado.sucesso ? 'enviado' : 'falhou',
        resultado.erro || null,
        JSON.stringify({ messageId: resultado.messageId }),
        'manual'
      ]
    );

    // Atualizar estatísticas do template
    if (resultado.sucesso) {
      await pool.query(
        `UPDATE templates 
         SET estatisticas = jsonb_set(
           estatisticas, 
           '{enviados}', 
           ((estatisticas->>'enviados')::int + 1)::text::jsonb
         )
         WHERE id = $1`,
        [template_id]
      );
    } else {
      await pool.query(
        `UPDATE templates 
         SET estatisticas = jsonb_set(
           estatisticas, 
           '{falhas}', 
           ((estatisticas->>'falhas')::int + 1)::text::jsonb
         )
         WHERE id = $1`,
        [template_id]
      );
    }

    if (!resultado.sucesso) {
      return res.status(500).json({ 
        error: 'Falha ao enviar', 
        detalhes: resultado.erro 
      });
    }

    res.json({ 
      message: 'Comunicação enviada com sucesso',
      messageId: resultado.messageId,
      preview: {
        assunto: assuntoFinal,
        conteudo: conteudoFinal.substring(0, 200) + '...'
      }
    });
  } catch (error) {
    console.error('Erro ao enviar template:', error);
    res.status(500).json({ error: 'Erro ao enviar template' });
  }
});

// ==========================================
// GET /comunicacao/estatisticas - Estatísticas de comunicação
// ==========================================
router.get('/estatisticas', async (req: Request, res: Response) => {
  try {
    const { dias = 30 } = req.query;

    const result = await pool.query(
      `SELECT 
        tipo,
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'enviado' OR status = 'entregue' OR status = 'lido' THEN 1 END) as sucesso,
        COUNT(CASE WHEN status = 'falhou' THEN 1 END) as falhas,
        COUNT(CASE WHEN status = 'lido' THEN 1 END) as lidos
       FROM historico_comunicacao
       WHERE enviado_em >= NOW() - INTERVAL '${parseInt(dias as string)} days'
       GROUP BY tipo`,
    );

    const estatisticas = {
      email: {
        total: 0,
        sucesso: 0,
        falhas: 0,
        lidos: 0,
        taxa_sucesso: 0,
        taxa_abertura: 0
      },
      whatsapp: {
        total: 0,
        sucesso: 0,
        falhas: 0,
        lidos: 0,
        taxa_sucesso: 0,
        taxa_leitura: 0
      }
    };

    result.rows.forEach(row => {
      const tipo = row.tipo as 'email' | 'whatsapp';
      const baseStats = {
        total: parseInt(row.total),
        sucesso: parseInt(row.sucesso),
        falhas: parseInt(row.falhas),
        lidos: parseInt(row.lidos),
        taxa_sucesso: parseInt(row.total) > 0 
          ? Math.round((parseInt(row.sucesso) / parseInt(row.total)) * 100)
          : 0,
        taxa_abertura: parseInt(row.total) > 0 
          ? Math.round((parseInt(row.lidos) / parseInt(row.total)) * 100)
          : 0,
        taxa_leitura: parseInt(row.total) > 0 
          ? Math.round((parseInt(row.lidos) / parseInt(row.total)) * 100)
          : 0
      };
      estatisticas[tipo] = baseStats;
    });

    res.json(estatisticas);
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({ error: 'Erro ao buscar estatísticas' });
  }
});

export default router;

