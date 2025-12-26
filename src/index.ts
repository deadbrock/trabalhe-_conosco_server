import express, { Router } from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { pool } from "./db";
import { vagasRouter } from "./routes/vagas";
import { candidatosRouter } from "./routes/candidatos";
import { authRouter } from "./routes/auth";
import { metricsRouter } from "./routes/metrics";
import { setupRouter } from "./routes/setup";
import { perfilRouter } from "./routes/perfil";
import comentariosRouter from "./routes/comentarios";
import tagsRouter from "./routes/tags";
import agendamentosRouter from "./routes/agendamentos";
import pontuacaoRouter from "./routes/pontuacao";
import notificacoesRouter from "./routes/notificacoes";
import atividadesRouter from "./routes/atividades";
import notasRouter from "./routes/notas";
import avaliacoesRouter from "./routes/avaliacoes";
import templatesRouter from "./routes/templates";
import comunicacaoRouter from "./routes/comunicacao";
import gatilhosRouter from "./routes/gatilhos";
import whatsappRouter from "./routes/whatsapp";
import lgpdRouter from "./routes/lgpd";
import documentosRouter from "./routes/documentos";
import { requireAuth } from "./middleware/auth";

dotenv.config();

// Criar pasta uploads se não existir
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const app = express();
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(uploadsDir));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Rota pública de status do WhatsApp (antes da autenticação)
app.get("/whatsapp-status", async (_req, res) => {
  try {
    const { verificarConexao } = await import("./services/whatsappService");
    const conectado = await verificarConexao();
    res.json({
      conectado,
      status: conectado ? 'connected' : 'disconnected',
      tipo: 'Twilio WhatsApp API',
      configurado: !!process.env.TWILIO_ACCOUNT_SID && !!process.env.TWILIO_AUTH_TOKEN
    });
  } catch (error: any) {
    res.status(500).json({ error: "Erro ao verificar status", message: error.message });
  }
});

// públicas
app.use("/auth", authRouter);
app.use("/setup", setupRouter);

// Rotas de vagas: combina rotas públicas e protegidas
const vagasCombinedRouter = Router();

// GET público (sem autenticação)
vagasCombinedRouter.use((req, res, next) => {
  if (req.method === "GET") {
    return next();
  }
  requireAuth(req, res, next);
});

vagasCombinedRouter.use(vagasRouter);
app.use("/vagas", vagasCombinedRouter);

// Rotas de candidatos: POST / público (candidatura) + demais protegidas (RH)
const candidatosCombinedRouter = Router();

// POST / público (candidatura sem autenticação), demais rotas protegidas
candidatosCombinedRouter.use((req, res, next) => {
  // Permitir POST apenas na rota raiz (candidatura pública)
  if (req.method === "POST" && req.path === "/") {
    return next(); // Permite candidatura pública
  }
  // Todas as outras rotas (GET, PUT, POST /:id/enviar-fgs, etc.) requerem autenticação
  requireAuth(req, res, next);
});

candidatosCombinedRouter.use(candidatosRouter);
app.use("/candidatos", candidatosCombinedRouter);

// protegidas (RH apenas)
app.use("/metrics", requireAuth, metricsRouter);
app.use("/perfil", requireAuth, perfilRouter);

// Novas rotas FASE 1 - Todas protegidas (RH apenas)
app.use("/comentarios", requireAuth, comentariosRouter);
app.use("/tags", requireAuth, tagsRouter);
app.use("/agendamentos", requireAuth, agendamentosRouter);
app.use("/pontuacao", requireAuth, pontuacaoRouter);

// Novas rotas FASE 3 - Todas protegidas (RH apenas)
app.use("/notificacoes", requireAuth, notificacoesRouter);
app.use("/atividades", requireAuth, atividadesRouter);
app.use("/notas", requireAuth, notasRouter);
app.use("/avaliacoes", requireAuth, avaliacoesRouter);

// Novas rotas SPRINT 2 - Comunicação Automatizada (RH apenas)
app.use("/templates", requireAuth, templatesRouter);
app.use("/comunicacao", requireAuth, comunicacaoRouter);
app.use("/gatilhos", requireAuth, gatilhosRouter);

// Rotas de WhatsApp: /status público, demais protegidas
app.use("/whatsapp", (req, res, next) => {
  // Rota /status é pública
  if (req.path === "/status") {
    return next();
  }
  // Demais rotas protegidas
  requireAuth(req, res, next);
}, whatsappRouter);

// Rotas LGPD: /solicitar e /validar-codigo públicas, demais protegidas
app.use("/lgpd", (req, res, next) => {
  // Rotas públicas para candidatos
  if (req.path === "/solicitar" || req.path === "/validar-codigo") {
    return next();
  }
  // Demais rotas protegidas (RH apenas)
  requireAuth(req, res, next);
}, lgpdRouter);

// Rotas Documentos: /login, /dados e /upload públicas, /gerar-credenciais protegida
app.use("/documentos", (req, res, next) => {
  // Rotas públicas para candidatos
  const isPublicRoute = 
    (req.method === "POST" && req.path === "/login") || // POST /documentos/login
    (req.method === "GET" && req.path === "/dados") || // GET /documentos/dados
    (req.method === "GET" && req.path === "/upload") || // GET /documentos/upload (página)
    (req.method === "POST" && req.path === "/upload") || // POST /documentos/upload (envio)
    (req.method === "POST" && req.path === "/upload-foto-3x4") || // POST /documentos/upload-foto-3x4 (foto com crop)
    (req.method === "POST" && req.path === "/autodeclaracao") || // POST /documentos/autodeclaracao
    (req.method === "GET" && req.path.match(/^\/[a-f0-9]{64}$/)) || // GET /documentos/:token (legado)
    (req.method === "POST" && req.path.match(/^\/[a-f0-9]{64}\/(upload|filhos)$/)); // POST /documentos/:token/upload (legado)
  
  if (isPublicRoute) {
    return next();
  }
  
  // Demais rotas protegidas (RH apenas)
  requireAuth(req, res, next);
}, documentosRouter);

// Executar migração de campos de perfil na inicialização (se necessário)
async function executarMigracaoPerfil() {
  try {
    const checkColumn = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='usuarios' AND column_name='foto_perfil'
      );
    `);
    
    if (!checkColumn.rows[0].exists) {
      console.log('📋 Colunas de perfil não existem. Adicionando...');
      
      const fs = await import('fs');
      const path = await import('path');
      const sqlPath = path.join(__dirname, 'migrations', 'add_usuario_perfil_fields.sql');
      const sql = fs.readFileSync(sqlPath, 'utf-8');
      
      await pool.query(sql);
      console.log('✅ Colunas de perfil adicionadas com sucesso!');
    }
  } catch (error) {
    console.error('⚠️ Erro ao verificar/adicionar colunas de perfil:', error);
  }
}

// Executar migração de documentos na inicialização (se necessário)
async function executarMigracaoDocumentos() {
  try {
    const checkTable = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'documentos_candidatos'
      );
    `);
    
    if (!checkTable.rows[0].exists) {
      console.log('📋 Tabela documentos_candidatos não existe. Criando...');
      
      const fs = await import('fs');
      const path = await import('path');
      const sqlPath = path.join(__dirname, 'migrations', 'create_documentos_candidatos.sql');
      const sql = fs.readFileSync(sqlPath, 'utf-8');
      
      await pool.query(sql);
      console.log('✅ Tabela documentos_candidatos criada com sucesso!');
    } else {
      console.log('✅ Tabela documentos_candidatos já existe');
    }
  } catch (error) {
    console.error('⚠️ Erro ao verificar/criar tabela documentos_candidatos:', error);
  }
}

const port = process.env.PORT || 3333;
app.listen(port, async () => {
  console.log(`🚀 API v1.3.2 listening on http://localhost:${port}`);
  console.log(`📱 WhatsApp Status disponível em: /whatsapp-status`);
  console.log(`🔗 Twilio WhatsApp API Configurado: ${!!process.env.TWILIO_ACCOUNT_SID}`);
  console.log(`🔐 Rotas LGPD disponíveis: /lgpd/solicitar, /lgpd/validar-codigo`);
  
  // Executar migrações automaticamente
  await executarMigracaoPerfil();
  await executarMigracaoDocumentos();
});
