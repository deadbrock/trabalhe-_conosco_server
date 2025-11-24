import { pool } from './db';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  console.log('🔄 Iniciando migração: criar tabela documentos_candidatos...\n');

  try {
    // Ler arquivo SQL
    const sqlPath = path.join(__dirname, 'migrations', 'create_documentos_candidatos.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    // Executar SQL
    console.log('📝 Executando SQL...');
    await pool.query(sql);

    console.log('\n✅ Migração concluída com sucesso!');
    console.log('\n📋 Tabela criada: documentos_candidatos');
    console.log('📋 Colunas principais:');
    console.log('   - candidato_id (FK)');
    console.log('   - token_acesso (unique)');
    console.log('   - [documento]_url');
    console.log('   - [documento]_validado');
    console.log('   - [documento]_rejeitado');
    console.log('   - comprovante_residencia_data_emissao');
    console.log('   - filhos_documentos (jsonb)');
    console.log('   - status');
    console.log('\n🎉 Sistema de documentos pronto para uso!');

    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Erro na migração:', error.message);
    
    if (error.message.includes('already exists')) {
      console.log('\n⚠️ A tabela já existe. Tudo certo!');
      process.exit(0);
    }
    
    process.exit(1);
  }
}

runMigration();

