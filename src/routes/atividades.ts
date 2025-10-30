import express from 'express';
import { Pool } from 'pg';

const router = express.Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// GET /atividades - Listar atividades com filtros
router.get('/', async (req, res) => {
  try {
    const { candidato_id, vaga_id, tipo, limit = 100, offset = 0 } = req.query;

    let query = `
      SELECT a.*, 
             c.nome as candidato_nome,
             v.titulo as vaga_titulo
      FROM atividades a
      LEFT JOIN candidatos c ON a.candidato_id = c.id
      LEFT JOIN vagas v ON a.vaga_id = v.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

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

    if (tipo) {
      query += ` AND a.tipo = $${paramIndex}`;
      params.push(tipo);
      paramIndex++;
    }

    query += ` ORDER BY a.criado_em DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar atividades:', error);
    res.status(500).json({ error: 'Erro ao buscar atividades' });
  }
});

// GET /atividades/candidato/:id - Atividades de um candidato específico
router.get('/candidato/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT a.*, 
              c.nome as candidato_nome,
              v.titulo as vaga_titulo
       FROM atividades a
       LEFT JOIN candidatos c ON a.candidato_id = c.id
       LEFT JOIN vagas v ON a.vaga_id = v.id
       WHERE a.candidato_id = $1
       ORDER BY a.criado_em DESC`,
      [id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar atividades do candidato:', error);
    res.status(500).json({ error: 'Erro ao buscar atividades do candidato' });
  }
});

// GET /atividades/estatisticas - Estatísticas de atividades
router.get('/estatisticas', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        tipo,
        COUNT(*) as total,
        DATE(criado_em) as data
      FROM atividades
      WHERE criado_em >= NOW() - INTERVAL '30 days'
      GROUP BY tipo, DATE(criado_em)
      ORDER BY DATE(criado_em) DESC, tipo
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({ error: 'Erro ao buscar estatísticas' });
  }
});

// Função auxiliar para registrar atividades (exportada para uso em outras rotas)
export async function registrarAtividade(
  usuario_id: number | null,
  usuario_nome: string,
  candidato_id: number | null,
  vaga_id: number | null,
  tipo: string,
  descricao: string,
  dados_extras?: any
) {
  try {
    await pool.query(
      `INSERT INTO atividades 
       (usuario_id, usuario_nome, candidato_id, vaga_id, tipo, descricao, dados_extras)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [usuario_id, usuario_nome, candidato_id, vaga_id, tipo, descricao, dados_extras ? JSON.stringify(dados_extras) : null]
    );

    // Atualizar última atividade do candidato
    if (candidato_id) {
      await pool.query(
        'UPDATE candidatos SET ultima_atividade = NOW() WHERE id = $1',
        [candidato_id]
      );
    }
  } catch (error) {
    console.error('Erro ao registrar atividade:', error);
  }
}

export default router;

