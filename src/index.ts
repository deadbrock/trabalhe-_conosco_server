import express, { Router } from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { vagasRouter } from "./routes/vagas";
import { candidatosRouter } from "./routes/candidatos";
import { authRouter } from "./routes/auth";
import { metricsRouter } from "./routes/metrics";
import { setupRouter } from "./routes/setup";
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
import gestaoRouter from "./routes/gestao";
import { requireAuth, optionalAuth, requireGestor } from "./middleware/auth";

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

// Rotas de vagas: GET é público mas aceita token opcional para filtrar por filial
const vagasCombinedRouter = Router();

vagasCombinedRouter.use((req, res, next) => {
  if (req.method === "GET") {
    // Tenta decodificar o token se presente, mas não bloqueia se ausente
    return optionalAuth(req, res, next);
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

// Rotas de Gestão: apenas para perfil "gestor"
app.use("/gestao", requireGestor, gestaoRouter);

const port = process.env.PORT || 3333;
app.listen(port, () => {
  console.log(`🚀 API v1.5.0 listening on http://localhost:${port}`);
  console.log(`📱 WhatsApp Status disponível em: /whatsapp-status`);
  console.log(`🔗 Twilio WhatsApp API Configurado: ${!!process.env.TWILIO_ACCOUNT_SID}`);
  console.log(`🔐 Rotas LGPD disponíveis: /lgpd/solicitar, /lgpd/validar-codigo`);
});
