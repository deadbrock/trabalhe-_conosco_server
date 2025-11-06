/**
 * ⚠️ Script para deletar APENAS os 3 candidatos de teste
 * 
 * NOMES A DELETAR:
 * 1. Douglas marques de souza
 * 2. Josiellen Santos Da Conceição  
 * 3. CLAUDIA AMARAL
 * 
 * ✅ SEGURO: Deleta APENAS esses 3 nomes específicos
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// NOMES EXATOS DOS CANDIDATOS A DELETAR
const CANDIDATOS_PARA_DELETAR = [
  'Douglas marques de souza',
  'Josiellen Santos Da Conceição',
  'CLAUDIA AMARAL'
];

async function deletarCandidatosTeste() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Buscando candidatos de teste...\n');
    
    // Buscar candidatos que correspondem aos nomes
    const result = await client.query(`
      SELECT id, nome, email, created_at 
      FROM candidatos 
      WHERE nome IN ($1, $2, $3)
      ORDER BY id
    `, CANDIDATOS_PARA_DELETAR);
    
    if (result.rows.length === 0) {
      console.log('✅ Nenhum candidato encontrado com esses nomes.');
      console.log('   Possíveis causas:');
      console.log('   - Já foram deletados');
      console.log('   - Nomes escritos diferentes no banco\n');
      return;
    }
    
    console.log(`📋 Encontrados ${result.rows.length} candidato(s):\n`);
    result.rows.forEach((c, i) => {
      console.log(`${i + 1}. ID: ${c.id}`);
      console.log(`   Nome: ${c.nome}`);
      console.log(`   Email: ${c.email}`);
      console.log(`   Criado em: ${new Date(c.created_at).toLocaleString('pt-BR')}`);
      console.log('');
    });
    
    console.log('⚠️  CONFIRMAÇÃO NECESSÁRIA!');
    console.log('   Este script vai deletar os candidatos acima.');
    console.log('   Os dados serão PERMANENTEMENTE removidos.\n');
    
    // Iniciar transação
    await client.query('BEGIN');
    
    let totalDeletados = 0;
    
    for (const candidato of result.rows) {
      console.log(`🗑️  Deletando: ${candidato.nome} (ID: ${candidato.id})`);
      
      // Deletar histórico de comunicação
      const commResult = await client.query(
        'DELETE FROM historico_comunicacao WHERE candidato_id = $1',
        [candidato.id]
      );
      console.log(`   → ${commResult.rowCount} registro(s) de comunicação deletado(s)`);
      
      // Deletar agendamentos
      const agendResult = await client.query(
        'DELETE FROM agendamentos WHERE candidato_id = $1',
        [candidato.id]
      );
      console.log(`   → ${agendResult.rowCount} agendamento(s) deletado(s)`);
      
      // Deletar notas
      const notasResult = await client.query(
        'DELETE FROM notas WHERE candidato_id = $1',
        [candidato.id]
      );
      console.log(`   → ${notasResult.rowCount} nota(s) deletada(s)`);
      
      // Deletar avaliações
      const avalResult = await client.query(
        'DELETE FROM avaliacoes WHERE candidato_id = $1',
        [candidato.id]
      );
      console.log(`   → ${avalResult.rowCount} avaliação(ões) deletada(s)`);
      
      // Deletar candidato
      await client.query(
        'DELETE FROM candidatos WHERE id = $1',
        [candidato.id]
      );
      console.log(`   ✅ Candidato deletado com sucesso!\n`);
      
      totalDeletados++;
    }
    
    // Commit da transação
    await client.query('COMMIT');
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ CONCLUÍDO!`);
    console.log(`   Total de candidatos deletados: ${totalDeletados}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ ERRO ao deletar candidatos:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

deletarCandidatosTeste()
  .then(() => {
    console.log('✅ Script concluído!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro ao executar script:', error);
    process.exit(1);
  });

