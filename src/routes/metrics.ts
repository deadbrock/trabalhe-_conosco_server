import { Router } from "express";
import { pool } from "../db";

export const metricsRouter = Router();

metricsRouter.get("/", async (req, res) => {
  const filialId: number = (req as any).user?.filial_id || 1;

  const [{ rows: vagas }, { rows: candidatos }, { rows: novosHoje }] = await Promise.all([
    pool.query(
      "SELECT COUNT(*)::int as total FROM vagas WHERE status = 'ativa' AND filial_id = $1",
      [filialId]
    ),
    pool.query(
      "SELECT COUNT(*)::int as total FROM candidatos WHERE filial_id = $1",
      [filialId]
    ),
    pool.query(
      "SELECT COUNT(*)::int as total FROM candidatos WHERE date(data_cadastro) = current_date AND filial_id = $1",
      [filialId]
    ),
  ]);

  res.json({
    vagas_abertas: vagas[0]?.total || 0,
    total_candidatos: candidatos[0]?.total || 0,
    candidatos_hoje: novosHoje[0]?.total || 0,
  });
});
