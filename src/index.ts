import express, { Router } from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { vagasRouter } from "./routes/vagas";
import { candidatosRouter } from "./routes/candidatos";
import { authRouter } from "./routes/auth";
import { metricsRouter } from "./routes/metrics";
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

// públicas
app.use("/auth", authRouter);

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

// Rotas de candidatos: POST público (candidatura) + GET/PUT protegidos (RH)
const candidatosCombinedRouter = Router();

// POST público (candidatura sem autenticação), GET e PUT protegidos
candidatosCombinedRouter.use((req, res, next) => {
  if (req.method === "POST") {
    return next(); // Permite candidatura pública
  }
  requireAuth(req, res, next); // Protege GET e PUT (RH apenas)
});

candidatosCombinedRouter.use(candidatosRouter);
app.use("/candidatos", candidatosCombinedRouter);

// protegidas (RH apenas)
app.use("/metrics", requireAuth, metricsRouter);

const port = process.env.PORT || 3333;
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
