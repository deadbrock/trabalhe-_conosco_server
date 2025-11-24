// Script simples para executar migração via Node.js
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function executarMigracao() {
  console.log('🔄 Conectando no banco de dados...\n');

  // Criar cliente PostgreSQL
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    // Conectar
    await client.connect();
    console.log('✅ Conectado ao banco!\n');

    // Ler arquivo SQL
    const sqlPath = path.join(__dirname, 'src', 'migrations', 'create_documentos_candidatos.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    console.log('📝 Executando migração...\n');

    // Executar SQL
    await client.query(sql);

    console.log('✅ Migração executada com sucesso!\n');
    console.log('📋 Tabela "documentos_candidatos" criada!\n');

    // Verificar se a tabela existe
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'documentos_candidatos'
    `);

    if (result.rows.length > 0) {
      console.log('✅ Verificação: Tabela existe no banco de dados!\n');
    }

    console.log('🎉 Sistema de documentos pronto para uso!\n');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    
    if (error.message.includes('already exists')) {
      console.log('\n⚠️ A tabela já existe. Tudo certo!\n');
    } else {
      process.exit(1);
    }
  } finally {
    await client.end();
  }
}

executarMigracao();

