/** Charge .env (apps/api/.env puis ../../.env) avant toute évaluation de module Nest (JwtModule.register lit process.env au chargement). */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
for (const p of [resolve(process.cwd(), ".env"), resolve(process.cwd(), "../../.env")]) {
  if (existsSync(p)) { try { process.loadEnvFile(p); } catch { /* ignore */ } }
}
