import { Router } from "express";
import { pool } from "../db";

export const metricsRouter = Router();

metricsRouter.get("/", async (_req, res) => {
  const [{ rows: vagas } , { rows: candidatos }, { rows: novosHoje }] = await Promise.all([
    pool.query("SELECT COUNT(*)::int as total FROM vagas WHERE status = 'ativa'"),
    pool.query("SELECT COUNT(*)::int as total FROM candidatos"),
    pool.query("SELECT COUNT(*)::int as total FROM candidatos WHERE date(data_cadastro) = current_date")
  ]);

  res.json({
    vagas_abertas: vagas[0]?.total || 0,
    total_candidatos: candidatos[0]?.total || 0,
    candidatos_hoje: novosHoje[0]?.total || 0,
  });
});
