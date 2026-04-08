import { Router, Request, Response } from "express";
import { pool } from "../db";

const router = Router();

// ==========================================
// DISTRIBUIÇÃO GEOGRÁFICA
// ==========================================
router.get("/geograficos", async (_req: Request, res: Response) => {
  try {
    const [estadosResult, cidadesResult, bairrosResult] = await Promise.all([
      pool.query(`
        SELECT
          COALESCE(NULLIF(TRIM(estado), ''), 'Não informado') AS nome,
          COUNT(*)::int AS total
        FROM candidatos
        WHERE dados_excluidos IS NOT TRUE
        GROUP BY 1
        ORDER BY total DESC
        LIMIT 15
      `),
      pool.query(`
        SELECT
          COALESCE(NULLIF(TRIM(cidade), ''), 'Não informado') AS nome,
          COUNT(*)::int AS total
        FROM candidatos
        WHERE dados_excluidos IS NOT TRUE
        GROUP BY 1
        ORDER BY total DESC
        LIMIT 10
      `),
      pool.query(`
        SELECT
          COALESCE(NULLIF(TRIM(bairro), ''), 'Não informado') AS nome,
          COUNT(*)::int AS total
        FROM candidatos
        WHERE dados_excluidos IS NOT TRUE
        GROUP BY 1
        ORDER BY total DESC
        LIMIT 10
      `),
    ]);

    res.json({
      estados: estadosResult.rows,
      cidades: cidadesResult.rows,
      bairros: bairrosResult.rows,
    });
  } catch (err: any) {
    console.error("Erro em /estatisticas/geograficos:", err);
    res.status(500).json({ error: "Erro ao buscar dados geográficos" });
  }
});

// ==========================================
// FUNIL DE STATUS
// ==========================================
router.get("/funil", async (req: Request, res: Response) => {
  try {
    const { data_inicio, data_fim } = req.query as Record<string, string>;

    const conditions: string[] = ["dados_excluidos IS NOT TRUE"];
    const params: string[] = [];

    if (data_inicio) {
      params.push(data_inicio);
      conditions.push(`data_cadastro >= $${params.length}::date`);
    }
    if (data_fim) {
      params.push(data_fim);
      conditions.push(`data_cadastro <= ($${params.length}::date + interval '1 day')`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await pool.query(`
      SELECT
        LOWER(TRIM(status)) AS status,
        COUNT(*)::int AS total
      FROM candidatos
      ${where}
      GROUP BY 1
      ORDER BY total DESC
    `, params);

    const ORDER = [
      "novo",
      "em análise",
      "em_análise",
      "pré-selecionado",
      "pré_selecionado",
      "entrevistado",
      "aprovado",
      "reprovado",
      "banco de talentos",
      "banco_de_talentos",
    ];

    const sorted = [...result.rows].sort((a, b) => {
      const ia = ORDER.indexOf(a.status);
      const ib = ORDER.indexOf(b.status);
      if (ia === -1 && ib === -1) return b.total - a.total;
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });

    res.json(sorted);
  } catch (err: any) {
    console.error("Erro em /estatisticas/funil:", err);
    res.status(500).json({ error: "Erro ao buscar funil de status" });
  }
});

// ==========================================
// EVOLUÇÃO TEMPORAL
// ==========================================
router.get("/evolucao", async (req: Request, res: Response) => {
  try {
    const dias = parseInt((req.query.dias as string) || "30", 10);

    const result = await pool.query(`
      SELECT
        DATE(data_cadastro) AS data,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE LOWER(TRIM(status)) = 'aprovado')::int AS aprovados,
        COUNT(*) FILTER (WHERE LOWER(TRIM(status)) = 'reprovado')::int AS reprovados
      FROM candidatos
      WHERE
        dados_excluidos IS NOT TRUE
        AND data_cadastro >= NOW() - ($1 || ' days')::interval
      GROUP BY 1
      ORDER BY 1 ASC
    `, [dias]);

    res.json(result.rows);
  } catch (err: any) {
    console.error("Erro em /estatisticas/evolucao:", err);
    res.status(500).json({ error: "Erro ao buscar evolução temporal" });
  }
});

// ==========================================
// PERFORMANCE POR VAGA
// ==========================================
router.get("/vagas-performance", async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT
        v.id,
        v.titulo,
        COUNT(c.id)::int AS total_candidatos,
        COUNT(c.id) FILTER (WHERE LOWER(TRIM(c.status)) = 'aprovado')::int AS aprovados,
        COUNT(c.id) FILTER (WHERE LOWER(TRIM(c.status)) = 'reprovado')::int AS reprovados,
        CASE
          WHEN COUNT(c.id) > 0
          THEN ROUND(
            COUNT(c.id) FILTER (WHERE LOWER(TRIM(c.status)) = 'aprovado')::numeric
            / COUNT(c.id) * 100, 1
          )
          ELSE 0
        END AS taxa_aprovacao
      FROM vagas v
      LEFT JOIN candidatos c
        ON c.vaga_id = v.id AND c.dados_excluidos IS NOT TRUE
      GROUP BY v.id, v.titulo
      ORDER BY total_candidatos DESC
      LIMIT 10
    `);

    res.json(result.rows);
  } catch (err: any) {
    console.error("Erro em /estatisticas/vagas-performance:", err);
    res.status(500).json({ error: "Erro ao buscar performance por vaga" });
  }
});

// ==========================================
// MOTIVOS DE REPROVAÇÃO
// ==========================================
router.get("/motivos-reprovacao", async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT
        TRIM(motivo_reprovacao) AS motivo,
        COUNT(*)::int AS total
      FROM candidatos
      WHERE
        dados_excluidos IS NOT TRUE
        AND LOWER(TRIM(status)) = 'reprovado'
        AND motivo_reprovacao IS NOT NULL
        AND TRIM(motivo_reprovacao) <> ''
      GROUP BY 1
      ORDER BY total DESC
      LIMIT 10
    `);

    res.json(result.rows);
  } catch (err: any) {
    console.error("Erro em /estatisticas/motivos-reprovacao:", err);
    res.status(500).json({ error: "Erro ao buscar motivos de reprovação" });
  }
});

// ==========================================
// TEMPO MÉDIO POR FASE
// ==========================================
router.get("/tempo-medio", async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT
        LOWER(TRIM(status)) AS status,
        ROUND(AVG(
          EXTRACT(EPOCH FROM (
            COALESCE(ultima_atividade, NOW()) - data_cadastro
          )) / 86400
        )::numeric, 1) AS media_dias,
        COUNT(*)::int AS total
      FROM candidatos
      WHERE
        dados_excluidos IS NOT TRUE
        AND data_cadastro IS NOT NULL
      GROUP BY 1
      ORDER BY media_dias DESC
    `);

    res.json(result.rows);
  } catch (err: any) {
    console.error("Erro em /estatisticas/tempo-medio:", err);
    res.status(500).json({ error: "Erro ao buscar tempo médio por fase" });
  }
});

export default router;
