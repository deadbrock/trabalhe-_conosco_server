/**
 * 🔄 MIGRAÇÃO: Adicionar novos status à tabela solicitacoes_lgpd
 * 
 * Novos status:
 * - aguardando_aprovacao_rh: Email não encontrado, aguardando ação do RH
 * - email_nao_encontrado: RH notificou solicitante sobre email não encontrado
 */

import { pool } from './db';

async function migrarStatusLGPD() {
  try {
    console.log('🔄 Iniciando migração de status LGPD...\n');

    // 1. Remover constraint antiga
    console.log('1️⃣ Removendo constraint antiga...');
    await pool.query(`
      ALTER TABLE solicitacoes_lgpd 
      DROP CONSTRAINT IF EXISTS solicitacoes_lgpd_status_check;
    `);
    console.log('✅ Constraint antiga removida\n');

    // 2. Adicionar nova constraint com todos os status
    console.log('2️⃣ Adicionando nova constraint com status expandidos...');
    await pool.query(`
      ALTER TABLE solicitacoes_lgpd 
      ADD CONSTRAINT solicitacoes_lgpd_status_check 
      CHECK (status IN (
        'pendente', 
        'em_analise', 
        'aprovada', 
        'concluida', 
        'rejeitada',
        'aguardando_aprovacao_rh',
        'email_nao_encontrado'
      ));
    `);
    console.log('✅ Nova constraint adicionada\n');

    // 3. Verificar constraint
    console.log('3️⃣ Verificando constraint...');
    const result = await pool.query(`
      SELECT conname 
      FROM pg_constraint 
      WHERE conname = 'solicitacoes_lgpd_status_check';
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ Constraint verificada:');
      console.log(`   Nome: ${result.rows[0].conname}\n`);
    }

    console.log('🎉 Migração concluída com sucesso!\n');
    console.log('📋 Status LGPD disponíveis:');
    console.log('   - pendente');
    console.log('   - em_analise');
    console.log('   - aprovada');
    console.log('   - concluida');
    console.log('   - rejeitada');
    console.log('   - aguardando_aprovacao_rh (NOVO)');
    console.log('   - email_nao_encontrado (NOVO)\n');

  } catch (error: any) {
    console.error('❌ Erro na migração:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Executar migração
migrarStatusLGPD()
  .then(() => {
    console.log('✅ Script finalizado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Falha na migração:', error);
    process.exit(1);
  });

