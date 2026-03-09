import express, { Request, Response } from "express";
import { pool } from "../db";
import { enviarEmail, substituirVariaveis as substituirVariaveisEmail } from "../services/emailService";
import { enviarWhatsApp, substituirVariaveis as substituirVariaveisWhatsApp } from "../services/whatsappService";

const router = express.Router();

interface AuthRequest extends Request {
  user?: {
    id: number;
    nome: string;
    email: string;
    filial_id?: number;
  };
}

// GET /comunicacao/historico
router.get("/historico", async (req: Request, res: Response) => {
  try {
    const filialId: number = (req as any).user?.filial_id || 1;
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
      WHERE hc.filial_id = $1
    `;
    const params: any[] = [filialId];
    let paramCount = 2;

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

    const countResult = await pool.query(
      "SELECT COUNT(*) FROM historico_comunicacao WHERE filial_id = $1",
      [filialId]
    );
    const total = parseInt(countResult.rows[0].count);

    res.json({
      historico: result.rows,
      total,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });
  } catch (error) {
    console.error("Erro ao listar histórico:", error);
    res.status(500).json({ error: "Erro ao listar histórico" });
  }
});

// POST /comunicacao/enviar
router.post("/enviar", async (req: AuthRequest, res: Response) => {
  try {
    const filialId: number = (req as any).user?.filial_id || 1;
    const { candidato_id, vaga_id, template_id, tipo, destinatario, assunto, conteudo, variaveis } = req.body;

    if (!tipo || !["email", "whatsapp"].includes(tipo)) {
      return res.status(400).json({ error: "Tipo inválido" });
    }

    if (!destinatario || !conteudo) {
      return res.status(400).json({ error: "Destinatário e conteúdo são obrigatórios" });
    }

    if (tipo === "email" && !assunto) {
      return res.status(400).json({ error: "Assunto é obrigatório para emails" });
    }

    let conteudoFinal = conteudo;
    let assuntoFinal = assunto;

    if (variaveis && Object.keys(variaveis).length > 0) {
      if (tipo === "email") {
        conteudoFinal = await substituirVariaveisEmail(conteudo, variaveis);
        if (assunto) assuntoFinal = await substituirVariaveisEmail(assunto, variaveis);
      } else {
        conteudoFinal = await substituirVariaveisWhatsApp(conteudo, variaveis);
      }
    }

    let resultado;
    if (tipo === "email") {
      resultado = await enviarEmail({ destinatario, assunto: assuntoFinal || "", conteudo: conteudoFinal });
    } else {
      resultado = await enviarWhatsApp({ numero: destinatario, mensagem: conteudoFinal });
    }

    await pool.query(
      `INSERT INTO historico_comunicacao
        (candidato_id, vaga_id, usuario_id, template_id, tipo, destinatario, assunto, conteudo, status, erro, metadata, enviado_por, filial_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        candidato_id || null,
        vaga_id || null,
        (req as any).user?.sub || null,
        template_id || null,
        tipo,
        destinatario,
        assuntoFinal || null,
        conteudoFinal,
        resultado.sucesso ? "enviado" : "falhou",
        resultado.erro || null,
        JSON.stringify({ messageId: resultado.messageId }),
        "manual",
        filialId,
      ]
    );

    if (!resultado.sucesso) {
      return res.status(500).json({ error: "Falha ao enviar", detalhes: resultado.erro });
    }

    res.json({ message: "Comunicação enviada com sucesso", messageId: resultado.messageId });
  } catch (error) {
    console.error("Erro ao enviar comunicação:", error);
    res.status(500).json({ error: "Erro ao enviar comunicação" });
  }
});

// POST /comunicacao/enviar-template
router.post("/enviar-template", async (req: AuthRequest, res: Response) => {
  try {
    const filialId: number = (req as any).user?.filial_id || 1;
    const { candidato_id, vaga_id, template_id, variaveis } = req.body;

    if (!template_id) {
      return res.status(400).json({ error: "template_id é obrigatório" });
    }

    const templateResult = await pool.query(
      "SELECT * FROM templates WHERE id = $1 AND ativo = true AND filial_id = $2",
      [template_id, filialId]
    );

    if (templateResult.rows.length === 0) {
      return res.status(404).json({ error: "Template não encontrado ou inativo" });
    }

    const template = templateResult.rows[0];
    let destinatario = "";
    let dadosVariaveis = { ...variaveis };

    if (candidato_id) {
      const candidatoResult = await pool.query(
        "SELECT * FROM candidatos WHERE id = $1 AND filial_id = $2",
        [candidato_id, filialId]
      );

      if (candidatoResult.rows.length > 0) {
        const candidato = candidatoResult.rows[0];
        destinatario = template.tipo === "email" ? candidato.email : candidato.telefone;
        dadosVariaveis = { nome: candidato.nome, email: candidato.email, telefone: candidato.telefone, ...dadosVariaveis };
      }
    }

    if (vaga_id) {
      const vagaResult = await pool.query(
        "SELECT * FROM vagas WHERE id = $1 AND filial_id = $2",
        [vaga_id, filialId]
      );
      if (vagaResult.rows.length > 0) {
        dadosVariaveis.vaga = vagaResult.rows[0].titulo;
      }
    }

    dadosVariaveis = {
      empresa: "FG Services",
      data: new Date().toLocaleDateString("pt-BR"),
      rh_nome: (req as any).user?.nome || "Equipe de RH",
      rh_email: (req as any).user?.email || "rh@fgservices.com.br",
      ...dadosVariaveis,
    };

    let conteudoFinal = template.conteudo;
    let assuntoFinal = template.assunto;

    if (template.tipo === "email") {
      conteudoFinal = await substituirVariaveisEmail(template.conteudo, dadosVariaveis);
      if (template.assunto) assuntoFinal = await substituirVariaveisEmail(template.assunto, dadosVariaveis);
    } else {
      conteudoFinal = await substituirVariaveisWhatsApp(template.conteudo, dadosVariaveis);
    }

    let resultado;
    if (template.tipo === "email") {
      resultado = await enviarEmail({ destinatario, assunto: assuntoFinal || "", conteudo: conteudoFinal });
    } else {
      resultado = await enviarWhatsApp({ numero: destinatario, mensagem: conteudoFinal });
    }

    await pool.query(
      `INSERT INTO historico_comunicacao
        (candidato_id, vaga_id, usuario_id, template_id, tipo, destinatario, assunto, conteudo, status, erro, metadata, enviado_por, filial_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        candidato_id || null,
        vaga_id || null,
        (req as any).user?.sub || null,
        template_id,
        template.tipo,
        destinatario,
        assuntoFinal || null,
        conteudoFinal,
        resultado.sucesso ? "enviado" : "falhou",
        resultado.erro || null,
        JSON.stringify({ messageId: resultado.messageId }),
        "manual",
        filialId,
      ]
    );

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
      return res.status(500).json({ error: "Falha ao enviar", detalhes: resultado.erro });
    }

    res.json({
      message: "Comunicação enviada com sucesso",
      messageId: resultado.messageId,
      preview: { assunto: assuntoFinal, conteudo: conteudoFinal.substring(0, 200) + "..." },
    });
  } catch (error) {
    console.error("Erro ao enviar template:", error);
    res.status(500).json({ error: "Erro ao enviar template" });
  }
});

// GET /comunicacao/estatisticas
router.get("/estatisticas", async (req: Request, res: Response) => {
  try {
    const filialId: number = (req as any).user?.filial_id || 1;
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
         AND filial_id = $1
       GROUP BY tipo`,
      [filialId]
    );

    const estatisticas = {
      email: { total: 0, sucesso: 0, falhas: 0, lidos: 0, taxa_sucesso: 0, taxa_abertura: 0 },
      whatsapp: { total: 0, sucesso: 0, falhas: 0, lidos: 0, taxa_sucesso: 0, taxa_leitura: 0 },
    };

    result.rows.forEach((row) => {
      const tipo = row.tipo as "email" | "whatsapp";
      estatisticas[tipo] = {
        total: parseInt(row.total),
        sucesso: parseInt(row.sucesso),
        falhas: parseInt(row.falhas),
        lidos: parseInt(row.lidos),
        taxa_sucesso: parseInt(row.total) > 0 ? Math.round((parseInt(row.sucesso) / parseInt(row.total)) * 100) : 0,
        taxa_abertura: parseInt(row.total) > 0 ? Math.round((parseInt(row.lidos) / parseInt(row.total)) * 100) : 0,
        taxa_leitura: parseInt(row.total) > 0 ? Math.round((parseInt(row.lidos) / parseInt(row.total)) * 100) : 0,
      };
    });

    res.json(estatisticas);
  } catch (error) {
    console.error("Erro ao buscar estatísticas:", error);
    res.status(500).json({ error: "Erro ao buscar estatísticas" });
  }
});

// POST /comunicacao/testar-email
router.post("/testar-email", async (req: Request, res: Response) => {
  try {
    const { destinatario, assunto, mensagem } = req.body;

    if (!destinatario) {
      return res.status(400).json({ error: "Destinatário é obrigatório" });
    }

    const assuntoFinal = assunto || "✅ Teste de Email - Sistema RH";
    const mensagemFinal =
      mensagem ||
      `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #4F46E5;">🎉 Email de Teste - Sistema RH</h2>
        <p>Olá!</p>
        <p>Este é um <strong>email de teste</strong> enviado pelo sistema de Recrutamento e Seleção.</p>
        <div style="background-color: #F3F4F6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #1F2937;">✅ Configuração do Email:</h3>
          <ul style="color: #4B5563;">
            <li>📧 Provedor: <strong>Resend</strong></li>
            <li>🌐 Domínio: <strong>trabalheconoscofg.com.br</strong></li>
            <li>⚡ Status: <strong>Funcionando</strong></li>
          </ul>
        </div>
        <p style="color: #6B7280;">Se você recebeu este email, significa que o sistema está <strong>100% operacional</strong>!</p>
        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
        <p style="font-size: 12px; color: #9CA3AF; text-align: center;">
          Enviado automaticamente pelo Sistema de RH<br>
          Data: ${new Date().toLocaleString("pt-BR")}
        </p>
      </div>
    `;

    const resultado = await enviarEmail({ destinatario, assunto: assuntoFinal, conteudo: mensagemFinal });

    if (!resultado.sucesso) {
      return res.status(500).json({ error: "Falha ao enviar email", detalhes: resultado.erro });
    }

    res.json({
      message: "✅ Email de teste enviado com sucesso!",
      destinatario,
      assunto: assuntoFinal,
      messageId: resultado.messageId,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("❌ Erro ao enviar email de teste:", error);
    res.status(500).json({ error: "Erro ao enviar email de teste", detalhes: error.message });
  }
});

export default router;
