import path from "path";
import dotenv from "dotenv";

const cwd = process.cwd();
dotenv.config({ path: path.resolve(cwd, ".env") });
dotenv.config({ path: path.resolve(cwd, "server", ".env") });
dotenv.config({ path: path.resolve(cwd, "..", ".env") });

if (!process.env.DATABASE_URL) {
  console.error(
    "\n❌ DATABASE_URL não encontrada.\n" +
      "   → Crie server/.env (ou .env na raiz do repo) com DATABASE_URL.\n" +
      "   → Não use public/.env no frontend — não é carregado pelo Next.js.\n" +
      "   → No Railway, use a URL pública do Postgres para testar no seu PC (não *.railway.internal).\n"
  );
}
