import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { vagasRouter } from "./routes/vagas";
import { candidatosRouter } from "./routes/candidatos";
import { authRouter } from "./routes/auth";
import { metricsRouter } from "./routes/metrics";
import { requireAuth } from "./middleware/auth";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// públicas
app.use("/auth", authRouter);

// Vagas públicas (GET apenas)
app.get("/vagas", vagasRouter);

// Candidatura pública (POST sem auth)
app.post("/candidatos", candidatosRouter);

// protegidas (RH apenas)
app.use("/vagas", requireAuth, vagasRouter); // POST, PUT, DELETE
app.use("/metrics", requireAuth, metricsRouter);
app.use("/candidatos", requireAuth, candidatosRouter); // GET, PUT

const port = process.env.PORT || 3333;
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
