import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization || "";
    const [, token] = header.split(" ");
    if (!token) {
      console.log('❌ Token ausente na requisição para:', req.path);
      return res.status(401).json({ error: "Token ausente" });
    }
    const secret = process.env.JWT_SECRET || "secret";
    const payload = jwt.verify(token, secret);
    (req as any).user = payload;
    console.log('✅ Token válido para usuário:', (payload as any).nome || (payload as any).email);
    next();
  } catch (err) {
    console.log('❌ Token inválido:', (err as Error).message);
    return res.status(401).json({ error: "Token inválido" });
  }
}
