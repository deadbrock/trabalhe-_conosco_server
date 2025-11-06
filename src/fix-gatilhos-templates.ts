/**
 * Script para vincular templates aos gatilhos
 * 
 * Isso garante que quando um status muda, o email correto é enviado
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function fixGatilhosTemplates() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Iniciando correção dos vínculos gatilhos → templates...\n');

    await client.query('BEGIN');

    // Buscar IDs dos templates
    const templatesResult = await client.query(`
      SELECT id, nome, tipo FROM templates WHERE ativo = true ORDER BY nome
    `);
    
    console.log('📋 Templates disponíveis:');
    templatesResult.rows.forEach(t => {
      console.log(`   ${t.id}. [${t.tipo}] ${t.nome}`);
    });
    console.log('');

    // Mapeamento de gatilhos → templates
    const vinculos = [
      {
        evento: 'inscricao_recebida',
        templateNome: '✅ Inscrição Confirmada'
      },
      {
        evento: 'status_em_analise',
        templateNome: '📋 Em Análise'
      },
      {
        evento: 'convite_entrevista',
        templateNome: '🎉 Convite para Entrevista'
      },
      {
        evento: 'status_aprovado',
        templateNome: '🎊 Candidato Aprovado'
      },
      {
        evento: 'status_reprovado',
        templateNome: '💼 Feedback do Processo Seletivo'
      }
    ];

    console.log('🔗 Vinculando templates aos gatilhos...\n');

    for (const vinculo of vinculos) {
      // Buscar template email
      const templateEmail = templatesResult.rows.find(
        t => t.nome === vinculo.templateNome && t.tipo === 'email'
      );

      // Buscar template whatsapp
      const templateWhatsApp = templatesResult.rows.find(
        t => t.nome === vinculo.templateNome && t.tipo === 'whatsapp'
      );

      if (templateEmail) {
        await client.query(`
          UPDATE configuracao_gatilhos
          SET template_email_id = $1,
              email_ativo = true
          WHERE evento = $2
        `, [templateEmail.id, vinculo.evento]);

        console.log(`✅ ${vinculo.evento}`);
        console.log(`   → Email: ${templateEmail.nome} (ID: ${templateEmail.id})`);
      } else {
        console.log(`⚠️  ${vinculo.evento}: Template email "${vinculo.templateNome}" não encontrado`);
      }

      if (templateWhatsApp) {
        await client.query(`
          UPDATE configuracao_gatilhos
          SET template_whatsapp_id = $1,
              whatsapp_ativo = false
          WHERE evento = $2
        `, [templateWhatsApp.id, vinculo.evento]);

        console.log(`   → WhatsApp: ${templateWhatsApp.nome} (ID: ${templateWhatsApp.id}) [DESABILITADO]`);
      }

      console.log('');
    }

    await client.query('COMMIT');

    console.log('🎉 Vínculos atualizados com sucesso!\n');

    // Mostrar configuração final
    const finalConfig = await client.query(`
      SELECT 
        g.evento,
        g.email_ativo,
        te.nome as template_email,
        g.whatsapp_ativo,
        tw.nome as template_whatsapp
      FROM configuracao_gatilhos g
      LEFT JOIN templates te ON g.template_email_id = te.id
      LEFT JOIN templates tw ON g.template_whatsapp_id = tw.id
      ORDER BY g.evento
    `);

    console.log('📊 Configuração Final:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    finalConfig.rows.forEach(row => {
      console.log(`\n📌 ${row.evento}:`);
      console.log(`   Email: ${row.email_ativo ? '✅' : '❌'} ${row.template_email || '(não configurado)'}`);
      console.log(`   WhatsApp: ${row.whatsapp_ativo ? '✅' : '❌'} ${row.template_whatsapp || '(não configurado)'}`);
    });
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('💥 Erro:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

fixGatilhosTemplates()
  .then(() => {
    console.log('✅ Script concluído!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro ao executar script:', error);
    process.exit(1);
  });

