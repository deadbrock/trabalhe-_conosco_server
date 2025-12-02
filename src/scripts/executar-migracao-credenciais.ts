import { pool } from '../db';
import * as fs from 'fs';
import * as path from 'path';

async function executarMigracao() {
  try {
    console.log('🔄 Iniciando migração de credenciais temporárias...');
    
    // Ler arquivo SQL
    const sqlPath = path.join(__dirname, '../migrations/create_credenciais_temporarias.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');
    
    console.log('📄 Arquivo SQL carregado');
    
    // Executar migração
    await pool.query(sql);
    
    console.log('✅ Migração executada com sucesso!');
    console.log('📊 Tabela credenciais_temporarias criada');
    
    // Verificar se a tabela foi criada
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'credenciais_temporarias'
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 Estrutura da tabela:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao executar migração:', error);
    process.exit(1);
  }
}

executarMigracao();

