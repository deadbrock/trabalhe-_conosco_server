import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config();

async function checkEnvironment() {
  console.log("\n🔍 Verificando configuração do ambiente...\n");

  let hasErrors = false;

  // Verificar variáveis obrigatórias
  const requiredVars = [
    "DATABASE_URL",
    "JWT_SECRET",
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
  ];

  console.log("📋 Variáveis de Ambiente:");
  console.log("─────────────────────────");

  for (const varName of requiredVars) {
    const value = process.env[varName];
    if (!value || value.trim() === "") {
      console.log(`❌ ${varName}: NÃO CONFIGURADA`);
      hasErrors = true;
    } else {
      // Mostrar apenas primeiros caracteres por segurança
      const preview = value.length > 20 ? value.substring(0, 20) + "..." : value;
      console.log(`✅ ${varName}: ${preview}`);
    }
  }

  console.log("\n");

  if (hasErrors) {
    console.log("❌ Erro: Algumas variáveis de ambiente não estão configuradas!");
    console.log("\n📖 Consulte o arquivo CONFIGURAR_ENV.md para instruções.\n");
    process.exit(1);
  }

  // Testar conexão com banco de dados
  console.log("🔌 Testando conexão com o banco de dados...");
  
  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    const client = await pool.connect();
    const result = await client.query("SELECT NOW()");
    
    console.log(`✅ Conexão bem-sucedida!`);
    console.log(`📅 Data/Hora do servidor: ${result.rows[0].now}`);
    
    client.release();
    await pool.end();
    
    console.log("\n✨ Todas as configurações estão corretas!");
    console.log("🚀 Você pode executar: npm run migrate:fase1\n");
    
  } catch (error: any) {
    console.log("❌ Erro ao conectar ao banco de dados!");
    console.log(`   ${error.message}\n`);
    console.log("💡 Verifique se a DATABASE_URL está correta.");
    console.log("📖 Consulte o arquivo CONFIGURAR_ENV.md\n");
    process.exit(1);
  }
}

checkEnvironment();

