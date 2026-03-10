import { Router, Request, Response } from "express";
import { pool } from "../db";
import bcrypt from "bcryptjs";

const router = Router();

// ==========================================
// MÉTRICAS CONSOLIDADAS (todas as filiais)
// ==========================================

router.get("/metricas", async (req: Request, res: Response) => {
  try {
    // Métricas gerais
    const [vagasResult, candidatosResult, novosHojeResult] = await Promise.all([
      pool.query("SELECT COUNT(*)::int as total FROM vagas WHERE status = 'ativa'"),
      pool.query("SELECT COUNT(*)::int as total FROM candidatos"),
      pool.query("SELECT COUNT(*)::int as total FROM candidatos WHERE date(data_cadastro) = current_date"),
    ]);

    // Métricas por filial
    const porFilialResult = await pool.query(`
      SELECT 
        f.id,
        f.nome as filial,
        COUNT(DISTINCT v.id) FILTER (WHERE v.status = 'ativa') as vagas_abertas,
        COUNT(DISTINCT c.id) as total_candidatos,
        COUNT(DISTINCT c.id) FILTER (WHERE date(c.data_cadastro) = current_date) as candidatos_hoje,
        COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'novo') as candidatos_novos,
        COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'Em análise') as em_analise,
        COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'Pré-selecionado') as pre_selecionados,
        COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'Aprovado') as aprovados
      FROM filiais f
      LEFT JOIN vagas v ON v.filial_id = f.id
      LEFT JOIN candidatos c ON c.filial_id = f.id
      WHERE f.ativa = TRUE
      GROUP BY f.id, f.nome
      ORDER BY f.id
    `);

    res.json({
      geral: {
        vagas_abertas: vagasResult.rows[0]?.total || 0,
        total_candidatos: candidatosResult.rows[0]?.total || 0,
        candidatos_hoje: novosHojeResult.rows[0]?.total || 0,
      },
      por_filial: porFilialResult.rows,
    });
  } catch (error) {
    console.error("Erro ao buscar métricas consolidadas:", error);
    res.status(500).json({ error: "Erro ao buscar métricas" });
  }
});

// ==========================================
// GESTÃO DE FILIAIS
// ==========================================

router.get("/filiais", async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT 
        f.*,
        COUNT(DISTINCT u.id) as total_usuarios,
        COUNT(DISTINCT v.id) FILTER (WHERE v.status = 'ativa') as vagas_ativas,
        COUNT(DISTINCT c.id) as total_candidatos
      FROM filiais f
      LEFT JOIN usuarios u ON u.filial_id = f.id
      LEFT JOIN vagas v ON v.filial_id = f.id
      LEFT JOIN candidatos c ON c.filial_id = f.id
      GROUP BY f.id
      ORDER BY f.id
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao listar filiais:", error);
    res.status(500).json({ error: "Erro ao listar filiais" });
  }
});

router.put("/filiais/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { nome, slug, ativa } = req.body;

    const result = await pool.query(
      `UPDATE filiais
       SET nome = COALESCE($1, nome),
           slug = COALESCE($2, slug),
           ativa = COALESCE($3, ativa)
       WHERE id = $4
       RETURNING *`,
      [nome, slug, ativa, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Filial não encontrada" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Erro ao atualizar filial:", error);
    res.status(500).json({ error: "Erro ao atualizar filial" });
  }
});

// ==========================================
// GESTÃO DE USUÁRIOS (todas as filiais)
// ==========================================

router.get("/usuarios", async (req: Request, res: Response) => {
  try {
    const { filial_id, perfil } = req.query;

    let query = `
      SELECT u.id, u.nome, u.email, u.perfil, u.filial_id, f.nome as filial_nome
      FROM usuarios u
      LEFT JOIN filiais f ON u.filial_id = f.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (filial_id) {
      query += ` AND u.filial_id = $${paramIndex}`;
      params.push(filial_id);
      paramIndex++;
    }

    if (perfil) {
      query += ` AND u.perfil = $${paramIndex}`;
      params.push(perfil);
      paramIndex++;
    }

    query += " ORDER BY u.filial_id, u.nome";

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao listar usuários:", error);
    res.status(500).json({ error: "Erro ao listar usuários" });
  }
});

router.post("/usuarios", async (req: Request, res: Response) => {
  try {
    const { nome, email, senha, perfil, filial_id } = req.body;

    if (!nome || !email || !senha || !perfil || !filial_id) {
      return res.status(400).json({ error: "Todos os campos são obrigatórios" });
    }

    if (!["admin", "gestor"].includes(perfil)) {
      return res.status(400).json({ error: 'Perfil inválido. Use "admin" ou "gestor"' });
    }

    const senhaHash = await bcrypt.hash(senha, 10);

    const result = await pool.query(
      `INSERT INTO usuarios (nome, email, senha_hash, perfil, filial_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, nome, email, perfil, filial_id`,
      [nome, email, senhaHash, perfil, filial_id]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    if (error.code === "23505") {
      return res.status(400).json({ error: "Email já cadastrado" });
    }
    console.error("Erro ao criar usuário:", error);
    res.status(500).json({ error: "Erro ao criar usuário" });
  }
});

router.put("/usuarios/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { nome, email, perfil, filial_id, nova_senha } = req.body;

    let senhaHash = undefined;
    if (nova_senha) {
      senhaHash = await bcrypt.hash(nova_senha, 10);
    }

    const result = await pool.query(
      `UPDATE usuarios
       SET nome = COALESCE($1, nome),
           email = COALESCE($2, email),
           perfil = COALESCE($3, perfil),
           filial_id = COALESCE($4, filial_id),
           senha_hash = COALESCE($5, senha_hash)
       WHERE id = $6
       RETURNING id, nome, email, perfil, filial_id`,
      [nome, email, perfil, filial_id, senhaHash, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    if (error.code === "23505") {
      return res.status(400).json({ error: "Email já cadastrado" });
    }
    console.error("Erro ao atualizar usuário:", error);
    res.status(500).json({ error: "Erro ao atualizar usuário" });
  }
});

router.delete("/usuarios/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const gestorId = (req as any).user?.sub;

    if (parseInt(String(id)) === gestorId) {
      return res.status(400).json({ error: "Você não pode excluir sua própria conta" });
    }

    const result = await pool.query(
      "DELETE FROM usuarios WHERE id = $1 RETURNING id, nome, email",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    res.json({ message: "Usuário excluído com sucesso", usuario: result.rows[0] });
  } catch (error) {
    console.error("Erro ao excluir usuário:", error);
    res.status(500).json({ error: "Erro ao excluir usuário" });
  }
});

// ==========================================
// AUDITORIA GLOBAL (todas as filiais)
// ==========================================

router.get("/auditoria", async (req: Request, res: Response) => {
  try {
    const { filial_id, tipo, limit = 100, offset = 0 } = req.query;

    let query = `
      SELECT 
        a.*,
        c.nome as candidato_nome,
        v.titulo as vaga_titulo,
        f.nome as filial_nome
      FROM atividades a
      LEFT JOIN candidatos c ON a.candidato_id = c.id
      LEFT JOIN vagas v ON a.vaga_id = v.id
      LEFT JOIN filiais f ON a.filial_id = f.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (filial_id) {
      query += ` AND a.filial_id = $${paramIndex}`;
      params.push(filial_id);
      paramIndex++;
    }

    if (tipo) {
      query += ` AND a.tipo = $${paramIndex}`;
      params.push(tipo);
      paramIndex++;
    }

    query += ` ORDER BY a.criado_em DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    const countResult = await pool.query("SELECT COUNT(*) as total FROM atividades");
    const total = parseInt(countResult.rows[0].total);

    res.json({
      atividades: result.rows,
      total,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });
  } catch (error) {
    console.error("Erro ao buscar auditoria:", error);
    res.status(500).json({ error: "Erro ao buscar auditoria" });
  }
});

// ==========================================
// RELATÓRIOS CONSOLIDADOS
// ==========================================

router.get("/relatorios/funil", async (req: Request, res: Response) => {
  try {
    const { filial_id, data_inicio, data_fim } = req.query;

    let whereClause = "WHERE 1=1";
    const params: any[] = [];
    let paramIndex = 1;

    if (filial_id) {
      whereClause += ` AND c.filial_id = $${paramIndex}`;
      params.push(filial_id);
      paramIndex++;
    }

    if (data_inicio) {
      whereClause += ` AND c.data_cadastro >= $${paramIndex}`;
      params.push(data_inicio);
      paramIndex++;
    }

    if (data_fim) {
      whereClause += ` AND c.data_cadastro <= $${paramIndex}`;
      params.push(data_fim);
      paramIndex++;
    }

    const result = await pool.query(
      `SELECT 
        c.status,
        COUNT(*) as total,
        f.nome as filial_nome
       FROM candidatos c
       LEFT JOIN filiais f ON c.filial_id = f.id
       ${whereClause}
       GROUP BY c.status, f.nome
       ORDER BY f.nome, 
         CASE c.status
           WHEN 'novo' THEN 1
           WHEN 'Em análise' THEN 2
           WHEN 'Pré-selecionado' THEN 3
           WHEN 'Entrevista agendada' THEN 4
           WHEN 'Aprovado' THEN 5
           WHEN 'Reprovado' THEN 6
           ELSE 7
         END`,
      params
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao gerar relatório de funil:", error);
    res.status(500).json({ error: "Erro ao gerar relatório" });
  }
});

router.get("/relatorios/vagas-performance", async (req: Request, res: Response) => {
  try {
    const { filial_id } = req.query;

    let whereClause = "";
    const params: any[] = [];

    if (filial_id) {
      whereClause = "WHERE v.filial_id = $1";
      params.push(filial_id);
    }

    const result = await pool.query(
      `SELECT 
        v.id,
        v.titulo,
        v.status,
        v.criado_em,
        f.nome as filial_nome,
        COUNT(c.id) as total_candidatos,
        COUNT(c.id) FILTER (WHERE c.status = 'Aprovado') as aprovados,
        COUNT(c.id) FILTER (WHERE c.status = 'Reprovado') as reprovados,
        ROUND(
          COUNT(c.id) FILTER (WHERE c.status = 'Aprovado')::numeric / 
          NULLIF(COUNT(c.id), 0) * 100, 
          2
        ) as taxa_aprovacao
       FROM vagas v
       LEFT JOIN candidatos c ON c.vaga_id = v.id
       LEFT JOIN filiais f ON v.filial_id = f.id
       ${whereClause}
       GROUP BY v.id, v.titulo, v.status, v.criado_em, f.nome
       ORDER BY v.criado_em DESC
       LIMIT 50`,
      params
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao gerar relatório de performance:", error);
    res.status(500).json({ error: "Erro ao gerar relatório" });
  }
});

router.get("/relatorios/tempo-medio", async (req: Request, res: Response) => {
  try {
    const { filial_id } = req.query;

    let whereClause = "";
    const params: any[] = [];

    if (filial_id) {
      whereClause = "WHERE c.filial_id = $1";
      params.push(filial_id);
    }

    const result = await pool.query(
      `SELECT 
        f.nome as filial_nome,
        c.status,
        COUNT(*) as total,
        ROUND(AVG(EXTRACT(EPOCH FROM (c.ultima_atividade - c.data_cadastro)) / 86400), 1) as dias_medio
       FROM candidatos c
       LEFT JOIN filiais f ON c.filial_id = f.id
       ${whereClause}
       GROUP BY f.nome, c.status
       ORDER BY f.nome, c.status`,
      params
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao calcular tempo médio:", error);
    res.status(500).json({ error: "Erro ao calcular tempo médio" });
  }
});

// ==========================================
// EXPORTAÇÃO DE DADOS (CSV/JSON)
// ==========================================

router.get("/exportar/candidatos", async (req: Request, res: Response) => {
  try {
    const { filial_id, formato = "json" } = req.query;

    let whereClause = "";
    const params: any[] = [];

    if (filial_id) {
      whereClause = "WHERE c.filial_id = $1";
      params.push(filial_id);
    }

    const result = await pool.query(
      `SELECT 
        c.*,
        v.titulo as vaga_titulo,
        f.nome as filial_nome
       FROM candidatos c
       LEFT JOIN vagas v ON c.vaga_id = v.id
       LEFT JOIN filiais f ON c.filial_id = f.id
       ${whereClause}
       ORDER BY c.data_cadastro DESC`,
      params
    );

    if (formato === "csv") {
      const campos = Object.keys(result.rows[0] || {});
      const csv = [
        campos.join(","),
        ...result.rows.map((row) =>
          campos.map((campo) => JSON.stringify(row[campo] || "")).join(",")
        ),
      ].join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=candidatos.csv");
      return res.send(csv);
    }

    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao exportar candidatos:", error);
    res.status(500).json({ error: "Erro ao exportar dados" });
  }
});

router.get("/exportar/vagas", async (req: Request, res: Response) => {
  try {
    const { filial_id, formato = "json" } = req.query;

    let whereClause = "";
    const params: any[] = [];

    if (filial_id) {
      whereClause = "WHERE v.filial_id = $1";
      params.push(filial_id);
    }

    const result = await pool.query(
      `SELECT 
        v.*,
        f.nome as filial_nome,
        COUNT(c.id) as total_candidatos
       FROM vagas v
       LEFT JOIN filiais f ON v.filial_id = f.id
       LEFT JOIN candidatos c ON c.vaga_id = v.id
       ${whereClause}
       GROUP BY v.id, f.nome
       ORDER BY v.criado_em DESC`,
      params
    );

    if (formato === "csv") {
      const campos = Object.keys(result.rows[0] || {});
      const csv = [
        campos.join(","),
        ...result.rows.map((row) =>
          campos.map((campo) => JSON.stringify(row[campo] || "")).join(",")
        ),
      ].join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=vagas.csv");
      return res.send(csv);
    }

    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao exportar vagas:", error);
    res.status(500).json({ error: "Erro ao exportar dados" });
  }
});

// ==========================================
// ESTATÍSTICAS AVANÇADAS
// ==========================================

router.get("/estatisticas/evolucao", async (req: Request, res: Response) => {
  try {
    const { filial_id, dias = 30 } = req.query;

    let whereClause = "";
    const params: any[] = [dias];
    let paramIndex = 2;

    if (filial_id) {
      whereClause = "AND c.filial_id = $2";
      params.push(filial_id);
      paramIndex++;
    }

    const result = await pool.query(
      `SELECT 
        DATE(c.data_cadastro) as data,
        f.nome as filial_nome,
        COUNT(*) as total_candidatos,
        COUNT(*) FILTER (WHERE c.status = 'Aprovado') as aprovados,
        COUNT(*) FILTER (WHERE c.status = 'Reprovado') as reprovados
       FROM candidatos c
       LEFT JOIN filiais f ON c.filial_id = f.id
       WHERE c.data_cadastro >= NOW() - INTERVAL '${parseInt(dias as string)} days'
       ${whereClause}
       GROUP BY DATE(c.data_cadastro), f.nome
       ORDER BY data DESC, f.nome`,
      params
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao buscar evolução:", error);
    res.status(500).json({ error: "Erro ao buscar evolução" });
  }
});

export default router;
