import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization || "";
    const [, token] = header.split(" ");
    if (!token) {
      return res.status(401).json({ error: "Token ausente" });
    }
    const secret = process.env.JWT_SECRET || "secret";
    const payload = jwt.verify(token, secret);
    (req as any).user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token inválido" });
  }
}
