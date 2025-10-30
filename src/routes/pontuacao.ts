import { Router, Request, Response } from "express";
import { pool } from "../db";

const router = Router();

/**
 * Critérios de Pontuação:
 * - Tempo de resposta rápido (dentro de 24h da publicação): +20 pontos
 * - Localização próxima (mesma cidade da vaga): +15 pontos
 * - Currículo anexado: +10 pontos
 * - Tags positivas: +5 pontos por tag
 * - Comentários importantes: +5 pontos por comentário importante
 * - Status avançado (entrevista/aprovado): +10 pontos
 */

async function calcularPontuacao(candidatoId: number): Promise<number> {
  const client = await pool.connect();
  let score = 0;
  
  try {
    // Buscar dados do candidato
    const candidatoResult = await client.query(
      `SELECT c.*, v.criado_em as vaga_criado_em, v.endereco as vaga_endereco
       FROM candidatos c
       LEFT JOIN vagas v ON c.vaga_id = v.id
       WHERE c.id = $1`,
      [candidatoId]
    );
    
    if (candidatoResult.rows.length === 0) {
      return 0;
    }
    
    const candidato = candidatoResult.rows[0];
    
    // 1. Tempo de resposta (candidatura dentro de 24h da publicação da vaga)
    if (candidato.vaga_criado_em && candidato.data_cadastro) {
      const vagaCriada = new Date(candidato.vaga_criado_em);
      const candidaturaCriada = new Date(candidato.data_cadastro);
      const diffHoras = (candidaturaCriada.getTime() - vagaCriada.getTime()) / (1000 * 60 * 60);
      
      if (diffHoras <= 24) {
        score += 20;
      } else if (diffHoras <= 48) {
        score += 10;
      }
    }
    
    // 2. Localização próxima
    if (candidato.cidade && candidato.vaga_endereco) {
      const cidadeVaga = candidato.vaga_endereco.toLowerCase();
      const cidadeCandidato = candidato.cidade.toLowerCase();
      
      if (cidadeVaga.includes(cidadeCandidato) || cidadeCandidato.includes(cidadeVaga)) {
        score += 15;
      }
    }
    
    // 3. Currículo anexado
    if (candidato.curriculo) {
      score += 10;
    }
    
    // 4. Tags do candidato
    const tagsResult = await client.query(
      "SELECT COUNT(*) as total FROM candidato_tags WHERE candidato_id = $1",
      [candidatoId]
    );
    
    const totalTags = parseInt(tagsResult.rows[0].total) || 0;
    score += totalTags * 5;
    
    // 5. Comentários importantes
    const comentariosResult = await client.query(
      "SELECT COUNT(*) as total FROM comentarios WHERE candidato_id = $1 AND importante = true",
      [candidatoId]
    );
    
    const totalComentariosImportantes = parseInt(comentariosResult.rows[0].total) || 0;
    score += totalComentariosImportantes * 5;
    
    // 6. Status avançado
    if (candidato.status === 'entrevista') {
      score += 10;
    } else if (candidato.status === 'aprovado') {
      score += 20;
    } else if (candidato.status === 'banco_talentos') {
      score += 15;
    }
    
    return score;
    
  } finally {
    client.release();
  }
}

// POST - Calcular e atualizar pontuação de um candidato
router.post("/calcular/:candidatoId", async (req: Request, res: Response) => {
  try {
    const { candidatoId } = req.params;
    
    const score = await calcularPontuacao(parseInt(candidatoId));
    
    await pool.query(
      "UPDATE candidatos SET score = $1 WHERE id = $2",
      [score, candidatoId]
    );
    
    res.json({ candidatoId, score, message: "Pontuação calculada com sucesso" });
  } catch (error) {
    console.error("Erro ao calcular pontuação:", error);
    res.status(500).json({ error: "Erro ao calcular pontuação" });
  }
});

// POST - Recalcular pontuação de todos os candidatos
router.post("/recalcular-todos", async (req: Request, res: Response) => {
  try {
    const candidatosResult = await pool.query("SELECT id FROM candidatos");
    const candidatos = candidatosResult.rows;
    
    let processados = 0;
    
    for (const candidato of candidatos) {
      const score = await calcularPontuacao(candidato.id);
      await pool.query(
        "UPDATE candidatos SET score = $1 WHERE id = $2",
        [score, candidato.id]
      );
      processados++;
    }
    
    res.json({
      message: "Pontuações recalculadas com sucesso",
      total: processados
    });
  } catch (error) {
    console.error("Erro ao recalcular pontuações:", error);
    res.status(500).json({ error: "Erro ao recalcular pontuações" });
  }
});

// GET - Ranking de candidatos por pontuação
router.get("/ranking", async (req: Request, res: Response) => {
  try {
    const { vaga_id, limit } = req.query;
    
    let query = `
      SELECT c.*, v.titulo as vaga_titulo
      FROM candidatos c
      LEFT JOIN vagas v ON c.vaga_id = v.id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    let paramIndex = 1;
    
    if (vaga_id) {
      query += ` AND c.vaga_id = $${paramIndex}`;
      params.push(vaga_id);
      paramIndex++;
    }
    
    query += " ORDER BY c.score DESC, c.data_cadastro ASC";
    
    if (limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(limit);
    }
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao buscar ranking:", error);
    res.status(500).json({ error: "Erro ao buscar ranking" });
  }
});

// GET - Candidatos por faixa de pontuação
router.get("/por-faixa", async (req: Request, res: Response) => {
  try {
    const { min_score, max_score } = req.query;
    
    let query = "SELECT * FROM candidatos WHERE 1=1";
    const params: any[] = [];
    let paramIndex = 1;
    
    if (min_score) {
      query += ` AND score >= $${paramIndex}`;
      params.push(min_score);
      paramIndex++;
    }
    
    if (max_score) {
      query += ` AND score <= $${paramIndex}`;
      params.push(max_score);
      paramIndex++;
    }
    
    query += " ORDER BY score DESC";
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao buscar candidatos por faixa:", error);
    res.status(500).json({ error: "Erro ao buscar candidatos por faixa" });
  }
});

export { calcularPontuacao };
export default router;

