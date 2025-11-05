import express from 'express';
import { Pool } from 'pg';
import { registrarAtividade } from './atividades';

const router = express.Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// GET /notas/candidato/:id - Listar notas de um candidato
router.get('/candidato/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT * FROM notas_candidatos 
       WHERE candidato_id = $1 
       ORDER BY criado_em DESC`,
      [id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar notas:', error);
    res.status(500).json({ error: 'Erro ao buscar notas' });
  }
});

// POST /notas - Criar nova nota
router.post('/', async (req, res) => {
  try {
    const userId = (req as any).userId;
    const userName = (req as any).userName || 'Usuário';
    const { candidato_id, nota, privada = true } = req.body;

    if (!candidato_id || !nota) {
      return res.status(400).json({ error: 'Dados incompletos' });
    }

    const result = await pool.query(
      `INSERT INTO notas_candidatos (candidato_id, usuario_id, usuario_nome, nota, privada)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [candidato_id, userId, userName, nota, privada]
    );

    // Registrar atividade
    const candidato = await pool.query('SELECT nome, vaga_id FROM candidatos WHERE id = $1', [candidato_id]);
    if (candidato.rows.length > 0) {
      await registrarAtividade(
        userId,
        userName,
        candidato_id,
        candidato.rows[0].vaga_id,
        'nota_adicionada',
        `${userName} adicionou uma nota em ${candidato.rows[0].nome}`,
        { nota_id: result.rows[0].id }
      );
    }

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar nota:', error);
    res.status(500).json({ error: 'Erro ao criar nota' });
  }
});

// PUT /notas/:id - Atualizar nota
router.put('/:id', async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;
    const { nota, privada } = req.body;

    const result = await pool.query(
      `UPDATE notas_candidatos 
       SET nota = COALESCE($1, nota),
           privada = COALESCE($2, privada),
           atualizado_em = NOW()
       WHERE id = $3 AND usuario_id = $4
       RETURNING *`,
      [nota, privada, id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Nota não encontrada ou sem permissão' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar nota:', error);
    res.status(500).json({ error: 'Erro ao atualizar nota' });
  }
});

// DELETE /notas/:id - Excluir nota
router.delete('/:id', async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM notas_candidatos WHERE id = $1 AND usuario_id = $2 RETURNING *',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Nota não encontrada ou sem permissão' });
    }

    res.json({ message: 'Nota excluída com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir nota:', error);
    res.status(500).json({ error: 'Erro ao excluir nota' });
  }
});

export default router;

